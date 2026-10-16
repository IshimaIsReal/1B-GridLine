const currentUser = window.monitorStorage.getCurrentUser() || {};

{
    const dashboardName = document.querySelector('#dashboard-name');
    const reportForm = document.querySelector('#report-form');
    const issueArea = document.querySelector('#issue-area');
    const locationStatus = document.querySelector('#location-status');
    const reportFeedback = document.querySelector('#report-feedback');
    const reportList = document.querySelector('#report-list');
    const emptyReports = document.querySelector('#empty-reports');
    const historyList = document.querySelector('#history-list');
    const emptyHistory = document.querySelector('#empty-history');
    const photoInput = document.querySelector('#issue-photo');
    const photoPreview = document.querySelector('#photo-preview');
    const photoPreviewImage = document.querySelector('#photo-preview-image');
    const photoStatus = document.querySelector('#photo-status');
    const userTabs = [...document.querySelectorAll('[role="tab"]')];
    const maxPhotoSize = 5 * 1024 * 1024;
    const maxStoredPhotoSize = 512 * 1024;
    let reportFeedbackTimeout;
    let reportFeedbackExitTimeout;
    const notificationDuration = 5000;
    const notificationExitDuration = 350;

    const setNotificationOrigin = notification => {
        const navigation = document.querySelector('.navigation');
        if (!navigation) {
            return;
        }
        const bounds = navigation.getBoundingClientRect();
        const horizontalOffset = bounds.left + bounds.width / 2 - document.documentElement.clientWidth / 2;
        const notificationStyle = getComputedStyle(notification);
        const destinationCenterY = Number.parseFloat(notificationStyle.top) + notification.offsetHeight / 2;
        const verticalOffset = bounds.top + bounds.height / 2 - destinationCenterY;
        notification.style.setProperty('--notification-origin-x', `${horizontalOffset}px`);
        notification.style.setProperty('--notification-origin-y', `${verticalOffset}px`);
    };

    const showReportFeedback = (message, state = 'success') => {
        clearTimeout(reportFeedbackTimeout);
        clearTimeout(reportFeedbackExitTimeout);
        reportFeedback.classList.toggle('is-error', state === 'error');
        reportFeedback.classList.remove('is-entering');
        reportFeedback.classList.remove('is-exiting');
        reportFeedback.textContent = message;
        document.body.classList.toggle('has-notification', Boolean(message));
        if (message) {
            setNotificationOrigin(reportFeedback);
            void reportFeedback.offsetWidth;
            reportFeedback.classList.add('is-entering');
            reportFeedbackTimeout = window.setTimeout(() => {
                reportFeedback.classList.remove('is-entering');
                reportFeedback.classList.add('is-exiting');
                reportFeedbackExitTimeout = window.setTimeout(() => {
                    reportFeedback.textContent = '';
                    reportFeedback.classList.remove('is-error', 'is-exiting');
                    document.body.classList.remove('has-notification');
                }, notificationExitDuration);
            }, notificationDuration - notificationExitDuration);
        }
    };

    dashboardName.textContent = currentUser.username || currentUser.email?.split('@')[0] || 'there';

    const positionUserTabIndicator = activeTab => {
        const tabs = activeTab.closest('.user-tabs');
        const tabBounds = activeTab.getBoundingClientRect();
        const tabsBounds = tabs.getBoundingClientRect();

        tabs.style.setProperty('--tab-indicator-left', `${tabBounds.left - tabsBounds.left - tabs.clientLeft}px`);
        tabs.style.setProperty('--tab-indicator-width', `${tabBounds.width}px`);
    };

    const activateUserTab = activeTab => {
        userTabs.forEach(tab => {
            const isActive = tab === activeTab;
            tab.setAttribute('aria-selected', String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
            document.querySelector(`#${tab.getAttribute('aria-controls')}`).hidden = !isActive;
        });
        positionUserTabIndicator(activeTab);
    };

    const initiallySelectedTab = userTabs.find(tab => tab.getAttribute('aria-selected') === 'true');
    if (initiallySelectedTab) {
        const tabs = initiallySelectedTab.closest('.user-tabs');
        positionUserTabIndicator(initiallySelectedTab);
        const updateActiveTabIndicator = () => {
            const activeTab = userTabs.find(tab => tab.getAttribute('aria-selected') === 'true');
            if (activeTab) positionUserTabIndicator(activeTab);
        };
        const tabSizeObserver = new ResizeObserver(updateActiveTabIndicator);
        userTabs.forEach(tab => tabSizeObserver.observe(tab));
        window.addEventListener('resize', updateActiveTabIndicator);
        window.addEventListener('load', () => {
            document.fonts.ready.then(() => {
                updateActiveTabIndicator();
                window.requestAnimationFrame(() => tabs.classList.add('is-ready'));
            });
        }, { once: true });
    }

    userTabs.forEach((tab, index) => {
        tab.addEventListener('click', () => activateUserTab(tab));
        tab.addEventListener('keydown', event => {
            let nextIndex = index;
            if (event.key === 'ArrowRight') {
                nextIndex = (index + 1) % userTabs.length;
            } else if (event.key === 'ArrowLeft') {
                nextIndex = (index - 1 + userTabs.length) % userTabs.length;
            } else if (event.key === 'Home') {
                nextIndex = 0;
            } else if (event.key === 'End') {
                nextIndex = userTabs.length - 1;
            } else {
                return;
            }

            event.preventDefault();
            userTabs[nextIndex].focus();
            activateUserTab(userTabs[nextIndex]);
        });
    });

    let reports = [];
    const refreshReports = async () => {
        reports = window.monitorStorage.getReports()
            .filter(report => report.userId === currentUser.id)
            .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
        renderReports();
    };
    const isPendingReport = report => report.status === 'Pending' || report.status === 'Open';
    const isOngoingReport = report => report.status === 'On-going' || report.status === 'Ongoing' || report.status === 'Confirmed';
    const isHistoryReport = report => ['Resolved', 'Solved', 'Archived'].includes(report.status);

    const blobToDataUrl = blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => resolve(reader.result));
        reader.addEventListener('error', () => reject(new Error('Could not read this image.')));
        reader.readAsDataURL(blob);
    });

    const preparePhotoAsDataUrl = async file => {
        const bitmap = await createImageBitmap(file);
        try {
            for (const maxDimension of [1600, 1280, 960]) {
                const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Could not process this image.');
                }
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

                for (const quality of [.82, .72, .62, .52]) {
                    const compressedBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
                    if (compressedBlob && compressedBlob.size <= maxStoredPhotoSize) {
                        return blobToDataUrl(compressedBlob);
                    }
                }
            }
        } finally {
            bitmap.close();
        }

        throw new Error('Could not reduce this photo enough to save it in this browser. Choose a smaller image.');
    };

    const validatePhoto = file => {
        if (!file) {
            return '';
        }
        if (!file.type.startsWith('image/')) {
            return 'Choose an image file.';
        }
        if (file.size > maxPhotoSize) {
            return 'Choose an image smaller than 5 MB.';
        }
        return '';
    };

    const createReportItem = (report, statusText) => {
        const item = document.createElement('li');
        item.className = 'report-item';

        const details = document.createElement('div');
        details.className = 'report-details';

        const title = document.createElement('span');
        title.className = 'report-type-value';
        title.textContent = report.type;
        const typeLabel = document.createElement('span');
        typeLabel.className = 'report-detail-label';
        typeLabel.textContent = 'Issue type';

        const area = document.createElement('span');
        area.className = 'report-area';
        area.textContent = report.area || 'Not provided';
        const areaLabel = document.createElement('span');
        areaLabel.className = 'report-detail-label report-area-label';
        areaLabel.textContent = 'Current area';

        const description = document.createElement('p');
        description.textContent = report.description;
        const descriptionLabel = document.createElement('span');
        descriptionLabel.className = 'report-detail-label';
        descriptionLabel.textContent = 'What happened?';

        if (typeof report.photoDataUrl === 'string' && report.photoDataUrl.startsWith('data:image/')) {
            const evidence = document.createElement('figure');
            evidence.className = 'report-photo-proof';

            const image = document.createElement('img');
            image.src = report.photoDataUrl;
            image.alt = `Photo evidence for ${report.type}`;

            const caption = document.createElement('figcaption');
            caption.textContent = 'Uploaded photo proof';
            evidence.append(image, caption);
            details.append(typeLabel, title, areaLabel, area, descriptionLabel, description, evidence);
        } else {
            const noPhoto = document.createElement('p');
            noPhoto.className = 'report-proof-missing';
            noPhoto.textContent = 'No photo proof attached';
            details.append(typeLabel, title, areaLabel, area, descriptionLabel, description, noPhoto);
        }

        const meta = document.createElement('div');
        meta.className = 'report-meta';

        const timestamp = document.createElement('time');
        timestamp.dateTime = report.createdAt;
        timestamp.textContent = new Date(report.createdAt).toLocaleString();

        const status = document.createElement('span');
        status.className = 'report-status';
        if (statusText === 'Resolved') {
            status.classList.add('is-resolved');
        } else if (statusText === 'On-going') {
            status.classList.add('is-ongoing');
        } else if (statusText === 'Removed') {
            status.classList.add('is-archived');
        }
        status.textContent = statusText;
        meta.append(timestamp, status);

        if (report.confirmedAt) {
            const confirmedAt = document.createElement('time');
            confirmedAt.className = 'report-resolved-at';
            confirmedAt.dateTime = report.confirmedAt;
            confirmedAt.textContent = `Confirmed ${new Date(report.confirmedAt).toLocaleString()}`;
            meta.append(confirmedAt);
        }

        if (report.scheduledAt) {
            const scheduledAt = document.createElement('time');
            scheduledAt.className = 'report-resolved-at';
            scheduledAt.dateTime = report.scheduledAt;
            scheduledAt.textContent = `Repair scheduled ${new Date(report.scheduledAt).toLocaleString()}`;
            meta.append(scheduledAt);
        }

        if (report.resolvedAt) {
            const resolvedAt = document.createElement('time');
            resolvedAt.className = 'report-resolved-at';
            resolvedAt.dateTime = report.resolvedAt;
            resolvedAt.textContent = `Repaired ${new Date(report.resolvedAt).toLocaleString()}`;
            meta.append(resolvedAt);
        }

        if (report.archivedAt) {
            const archivedAt = document.createElement('time');
            archivedAt.className = 'report-resolved-at';
            archivedAt.dateTime = report.archivedAt;
            archivedAt.textContent = `Removed ${new Date(report.archivedAt).toLocaleString()}`;
            meta.append(archivedAt);
        }

        item.append(details, meta);
        return item;
    };

    const renderReports = () => {
        const pendingReports = reports.filter(isPendingReport);
        const activeReports = reports.filter(report => isPendingReport(report) || isOngoingReport(report));
        const historyReports = reports.filter(isHistoryReport);
        reportList.replaceChildren();
        historyList.replaceChildren();
        emptyReports.hidden = activeReports.length > 0;
        emptyHistory.hidden = historyReports.length > 0;

        activeReports.forEach(report => {
            const status = isOngoingReport(report) ? 'On-going' : 'Pending';
            reportList.append(createReportItem(report, status));
        });
        historyReports.forEach(report => {
            historyList.append(createReportItem(report, report.status === 'Archived' ? 'Removed' : 'Resolved'));
        });

        document.querySelector('#total-reports').textContent = reports.length;
        document.querySelector('#open-reports').textContent = pendingReports.length;
        document.querySelector('#report-count').textContent = `${activeReports.length} active`;
        document.querySelector('#history-count').textContent = `${historyReports.length} items`;
    };

    document.querySelector('#logout-button').addEventListener('click', () => {
        window.monitorStorage.clearCurrentUser();
        window.location.assign('index.html');
    });

    const locateButton = document.querySelector('#locate-button');
    const submitReportButton = reportForm.querySelector('[type="submit"]');
    let isDashboardReady = false;
    let isSubmittingReport = false;
    submitReportButton.disabled = true;
    let selectedPhotoDataUrl = '';

    photoInput.addEventListener('change', async () => {
        selectedPhotoDataUrl = '';
        photoPreview.hidden = true;
        photoStatus.textContent = '';
        const file = photoInput.files[0];
        const validationMessage = validatePhoto(file);
        if (validationMessage) {
            photoInput.value = '';
            photoStatus.textContent = validationMessage;
            return;
        }
        if (!file) {
            return;
        }

        photoStatus.textContent = 'Preparing photo...';
        submitReportButton.disabled = true;
        try {
            selectedPhotoDataUrl = await preparePhotoAsDataUrl(file);
            photoPreviewImage.src = selectedPhotoDataUrl;
            photoPreview.hidden = false;
            photoStatus.textContent = 'Photo ready to attach. A smaller copy will be saved with the report.';
        } catch (error) {
            photoInput.value = '';
            selectedPhotoDataUrl = '';
            photoStatus.textContent = error.message;
        } finally {
            submitReportButton.disabled = !isDashboardReady || isSubmittingReport;
        }
    });

    locateButton.addEventListener('click', () => {
        if (!navigator.geolocation) {
            locationStatus.textContent = 'Device location is unavailable. Enter the area manually.';
            return;
        }

        locateButton.disabled = true;
        locationStatus.textContent = 'Finding your location and looking up its address...';
        navigator.geolocation.getCurrentPosition(async position => {
            const query = new URLSearchParams({
                format: 'jsonv2',
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                zoom: '18',
                addressdetails: '1'
            });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${query}`, {
                    signal: controller.signal
                });
                if (!response.ok) {
                    throw new Error('Address lookup failed');
                }

                const place = await response.json();
                const address = place.address || {};
                const street = [
                    address.house_number,
                    address.road || address.pedestrian || address.residential || address.footway || address.path
                ].filter(Boolean).join(' ');
                const neighborhood = address.neighbourhood || address.suburb || address.quarter || address.city_district || address.village || address.hamlet;
                const city = address.city || address.town || address.municipality || address.county;
                const shortAddress = [street, neighborhood, city]
                    .filter((part, index, parts) => part && parts.findIndex(candidate => candidate?.toLowerCase() === part.toLowerCase()) === index)
                    .join(', ');
                const fallbackAddress = place.name || place.display_name?.split(',').slice(0, 2).join(',').trim();
                if (!shortAddress && !fallbackAddress) {
                    throw new Error('No address found');
                }

                issueArea.value = shortAddress || fallbackAddress;
                locationStatus.textContent = 'Address found. Check it for accuracy.';
            } catch {
                locationStatus.textContent = 'Could not look up an address. Enter the current area manually.';
            } finally {
                clearTimeout(timeoutId);
                locateButton.disabled = false;
            }
        }, error => {
            locationStatus.textContent = error.code === error.PERMISSION_DENIED
                ? 'Location permission was denied. Enter the area manually.'
                : 'Could not get your location. Enter the area manually.';
            locateButton.disabled = false;
        }, { enableHighAccuracy: true, timeout: 10000 });
    });

    reportForm.addEventListener('submit', async event => {
        event.preventDefault();
        showReportFeedback('');
        if (!isDashboardReady) {
            showReportFeedback('Wait for your dashboard to finish loading before submitting.', 'error');
            return;
        }
        const photoFile = photoInput.files[0];
        const validationMessage = validatePhoto(photoFile);
        if (validationMessage) {
            photoStatus.textContent = validationMessage;
            return;
        }

        if (photoFile && !selectedPhotoDataUrl) {
            photoStatus.textContent = 'Wait for the photo to finish preparing, then submit again.';
            return;
        }

        const formData = new FormData(reportForm);
        isSubmittingReport = true;
        submitReportButton.disabled = true;
        photoInput.disabled = true;
        try {
            const allReports = window.monitorStorage.getReports();
            allReports.unshift({
                id: crypto.randomUUID(),
                userId: currentUser.id,
                type: formData.get('type'),
                area: formData.get('area').trim(),
                description: formData.get('description').trim(),
                photoDataUrl: selectedPhotoDataUrl,
                createdAt: new Date().toISOString(),
                status: 'Pending'
            });
            window.monitorStorage.saveReports(allReports);
            reports = allReports.filter(report => report.userId === currentUser.id);
            renderReports();
            reportForm.reset();
            selectedPhotoDataUrl = '';
            photoPreview.hidden = true;
            photoPreviewImage.removeAttribute('src');
            photoStatus.textContent = '';
            locationStatus.textContent = '';
            showReportFeedback('Your report has been saved in this browser.');
        } catch (error) {
            showReportFeedback(`Could not save your report: ${error.message}`, 'error');
        } finally {
            isSubmittingReport = false;
            photoInput.disabled = false;
            submitReportButton.disabled = !isDashboardReady;
        }
    });

    const initializeDashboard = async () => {
        const account = window.monitorStorage.getAccounts().find(candidate => candidate.id === currentUser.id);
        if (!account) {
            window.monitorStorage.clearCurrentUser();
            window.location.replace('index.html');
            return;
        }
        if (window.monitorStorage.isAdminEmail(account.email)) {
            window.location.replace('admin.html');
            return;
        }

        currentUser.id = account.id;
        currentUser.email = account.email;
        dashboardName.textContent = account.username || account.email.split('@')[0];
        await refreshReports();
        isDashboardReady = true;
        submitReportButton.disabled = false;
    };

    initializeDashboard().catch(error => {
        showReportFeedback(`Could not load your reports: ${error.message}`, 'error');
    });
    window.addEventListener('focus', () => refreshReports().catch(error => {
        showReportFeedback(`Could not refresh reports: ${error.message}`, 'error');
    }));
    window.addEventListener('storage', event => {
        if (event.key === 'monitor-local-reports') {
            refreshReports();
        }
    });
}