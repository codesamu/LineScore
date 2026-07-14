const socket = io({
    transports: ['websocket', 'polling'],
    upgrade: true
});

// --- API Helpers ---
async function fetchAPI(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) {
        options.body = JSON.stringify(body);
    }
    const res = await fetch(endpoint, options);
    let data;
    try {
        data = await res.json();
    } catch(e) {
        throw new Error(`Server returned an invalid response (${res.status}). Please try restarting your server process (e.g., node server.js) to apply backend updates!`);
    }
    if (!res.ok) {
        throw new Error(data.error || data.message || 'API request failed');
    }
    return data;
}

// --- Global Branding Visibility ---
function applyBrandingVisibility(isLicensed) {
    document.querySelectorAll('.made-by-branding').forEach(el => {
        if (isLicensed) {
            el.classList.add('hidden');
        } else {
            el.classList.remove('hidden');
        }
    });
}

function applyAppName(appName) {
    const name = (appName || 'LineScore').trim() || 'LineScore';
    document.querySelectorAll('[data-app-name]').forEach(el => {
        el.textContent = name;
    });

    if (document.body.classList.contains('leaderboard-page')) {
        document.title = name;
    }
}

function applyAppIcon(appIconUrl) {
    const iconUrl = (appIconUrl || '/favicon.ico').trim() || '/favicon.ico';
    let iconLink = document.querySelector('link[rel="icon"]');
    if (!iconLink) {
        iconLink = document.createElement('link');
        iconLink.rel = 'icon';
        document.head.appendChild(iconLink);
    }

    const urlWithoutQuery = iconUrl.split('?')[0];
    const isIco = urlWithoutQuery.endsWith('.ico');
    iconLink.type = isIco ? 'image/x-icon' : '';
    iconLink.href = iconUrl;

    const preview = document.getElementById('app-icon-preview');
    if (preview) {
        preview.src = iconUrl;
    }
}

function showLicenseLockOverlay() {
    if (document.getElementById('license-lock-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'license-lock-overlay';
    overlay.className = 'license-lock-overlay';
    overlay.innerHTML = `
        <div class="lock-card card">
            <span class="lock-icon">🔒</span>
            <h2>Commercial License Required</h2>
            <p style="margin-bottom: 1.5rem; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.6;">
                An active commercial license is required to run this application. The system has been locked.
            </p>
            <div class="flex-row" style="justify-content: center; gap: 1rem; flex-wrap: wrap;">
                <a href="/admin" class="btn-primary btn-small">Admin Panel</a>
                <a href="mailto:[Email Address]" class="btn-secondary btn-small">Request License</a>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function checkBranding() {
    try {
        const cfg = await fetchAPI('/config');
        applyBrandingVisibility(cfg.isLicensed);
        applyAppName(cfg.appName);
        applyAppIcon(cfg.appIconUrl);
        return cfg;
    } catch(e) {
        console.error('Failed to check branding', e);
    }
}

const isoCountryCodes = [
    'AC','AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
    'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ',
    'CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CP','CR','CU','CV','CW','CX','CY','CZ',
    'DE','DG','DJ','DK','DM','DO','DZ','EA','EC','EE','EG','EH','ER','ES','ET','EU','EZ',
    'FI','FJ','FK','FM','FO','FR',
    'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY',
    'HK','HM','HN','HR','HT','HU',
    'IC','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
    'JE','JM','JO','JP',
    'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
    'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
    'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
    'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
    'OM',
    'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
    'QA','QO','RE','RO','RS','RU','RW',
    'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
    'TA','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
    'UA','UG','UM','UN','US','UY','UZ',
    'VA','VC','VE','VG','VI','VN','VU',
    'WF','WS',
    'XK',
    'YE','YT',
    'ZA','ZM','ZW'
];

const countryDisplayNames = typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null;

function countryNameFromCode(code) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(normalizedCode)) return '';
    if (countryDisplayNames) {
        const name = countryDisplayNames.of(normalizedCode);
        if (name && name !== normalizedCode) return name;
    }
    return normalizedCode;
}

function countryCodeFromInput(country) {
    const value = String(country || '').trim();
    if (!value) return '';
    const directCode = value.toUpperCase();
    if (/^[A-Z]{2}$/.test(directCode)) return directCode;
    const lowerValue = value.toLowerCase();
    return isoCountryCodes.find(code => countryNameFromCode(code).toLowerCase() === lowerValue) || '';
}

function normalizeCountryName(country) {
    const value = String(country || '').trim();
    if (!value) return '';
    const code = countryCodeFromInput(value);
    return code ? countryNameFromCode(code) : value;
}

function countryFlag(country) {
    const code = countryCodeFromInput(country);
    if (!code || !/^[A-Z]{2}$/.test(code)) return '';
    return code.replace(/./g, char => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// --- Leaderboard Logic ---
function initLeaderboard() {
    const leaderboardListEl = document.getElementById('leaderboard-list');
    const startlistListEl = document.getElementById('startlist-list');
    const noLeaderboardEl = document.getElementById('no-leaderboard-data');
    const noStartlistEl = document.getElementById('no-startlist-data');
    const tvFeatureEl = document.getElementById('tv-athlete-feature');
    const tvPhotoEl = document.getElementById('tv-athlete-photo');
    const tvPhotoPlaceholderEl = document.getElementById('tv-athlete-photo-placeholder');
    const tvNameEl = document.getElementById('tv-athlete-name');
    const tvCountryEl = document.getElementById('tv-athlete-country');

    // Tab Switching Logic
    const tabLeaderboard = document.getElementById('tab-leaderboard');
    const tabStartlist = document.getElementById('tab-startlist');
    const tabSplit = document.getElementById('tab-split');
    const contentLeaderboard = document.getElementById('leaderboard-tab-content');
    const contentStartlist = document.getElementById('startlist-tab-content');

    tabLeaderboard.addEventListener('click', () => {
        tabLeaderboard.classList.add('active');
        tabStartlist.classList.remove('active');
        tabSplit.classList.remove('active');
        contentLeaderboard.classList.remove('hidden');
        contentStartlist.classList.add('hidden');
        document.querySelector('main').classList.remove('split-view');
        document.querySelector('.container').classList.remove('split-container');
    });

    tabStartlist.addEventListener('click', () => {
        tabStartlist.classList.add('active');
        tabLeaderboard.classList.remove('active');
        tabSplit.classList.remove('active');
        contentStartlist.classList.remove('hidden');
        contentLeaderboard.classList.add('hidden');
        document.querySelector('main').classList.remove('split-view');
        document.querySelector('.container').classList.remove('split-container');
    });

    tabSplit.addEventListener('click', () => {
        tabSplit.classList.add('active');
        tabLeaderboard.classList.remove('active');
        tabStartlist.classList.remove('active');
        contentLeaderboard.classList.remove('hidden');
        contentStartlist.classList.remove('hidden');
        document.querySelector('main').classList.add('split-view');
        document.querySelector('.container').classList.add('split-container');
    });

    // TV Mode Controller & Dynamic State
    const tvModeBtn = document.getElementById('tv-mode-btn');
    const exitTvBtn = document.getElementById('exit-tv-btn');
    const tabContainer = document.querySelector('.tabs');
    const footer = document.querySelector('footer');
    let tvButtonTimeout = null;

    let completedAthletesCache = new Map();
    let firstLoadCompleted = false;
    let tvScrollRAF = null;
    let currentScrollY = 0;
    let scrollDirection = 1; // 1 = down, -1 = up
    let isScrollPaused = false;
    let lastFrameTime = 0;

    function animateTVScroll(timestamp) {
        if (!tvScrollRAF) return;

        const startlistContainer = document.getElementById('startlist-tab-content');
        const startlistList = document.getElementById('startlist-list');

        if (startlistContainer && startlistList && !isScrollPaused) {
            const maxScroll = startlistList.offsetHeight - startlistContainer.clientHeight;
            
            if (maxScroll > 0) {
                if (!lastFrameTime) lastFrameTime = timestamp;
                const delta = Math.min(timestamp - lastFrameTime, 100);
                lastFrameTime = timestamp;

                const speed = 0.025; // 25 subpixels per second, extremely smooth
                currentScrollY += scrollDirection * speed * delta;

                if (currentScrollY > maxScroll) currentScrollY = maxScroll;
                if (currentScrollY < 0) currentScrollY = 0;

                startlistList.style.transform = `translate3d(0, ${-currentScrollY}px, 0)`;
                startlistList.style.transition = 'transform 0.08s linear';

                if (scrollDirection === 1 && currentScrollY >= maxScroll) {
                    isScrollPaused = true;
                    setTimeout(() => {
                        scrollDirection = -1;
                        isScrollPaused = false;
                    }, 2000); // 2 sec pause at bottom
                } else if (scrollDirection === -1 && currentScrollY <= 0) {
                    isScrollPaused = true;
                    setTimeout(() => {
                        scrollDirection = 1;
                        isScrollPaused = false;
                    }, 2000); // 2 sec pause at top
                }
            } else {
                startlistList.style.transform = '';
            }
        } else {
            lastFrameTime = timestamp;
        }

        tvScrollRAF = requestAnimationFrame(animateTVScroll);
    }

    function startTVScrolling() {
        stopTVScrolling();
        const startlistList = document.getElementById('startlist-list');
        if (startlistList) {
            startlistList.style.transform = 'translate3d(0, 0, 0)';
        }
        currentScrollY = 0;
        scrollDirection = 1;
        isScrollPaused = false;
        lastFrameTime = 0;
        tvScrollRAF = requestAnimationFrame(animateTVScroll);
    }

    function stopTVScrolling() {
        if (tvScrollRAF) {
            cancelAnimationFrame(tvScrollRAF);
            tvScrollRAF = null;
        }
        const startlistList = document.getElementById('startlist-list');
        if (startlistList) {
            startlistList.style.transform = '';
            startlistList.style.transition = '';
        }
    }

    function triggerTVAnnouncement(name, score, rank, titleText = "Run Completed!") {
        let popup = document.getElementById('tv-announcement-popup');
        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'tv-announcement-popup';
            popup.className = 'tv-popup';
            document.body.appendChild(popup);
        }

        let rankBadge = '';
        if (rank === 1) rankBadge = '<div class="badge" style="background: #fbbf24; color: #78350f;">🏆 1st PLACE</div>';
        else if (rank === 2) rankBadge = '<div class="badge" style="background: #d1d5db; color: #374151;">🥈 2nd PLACE</div>';
        else if (rank === 3) rankBadge = '<div class="badge" style="background: #f59e0b; color: #78350f;">🥉 3rd PLACE</div>';
        else rankBadge = `<div class="badge" style="background: rgba(255,255,255,0.2); color: white;">Rank #${rank}</div>`;

        popup.innerHTML = `
            <h2>${titleText}</h2>
            <div class="athlete-name">${name}</div>
            <div class="stats">${score} pts</div>
            ${rankBadge}
        `;

        popup.classList.add('show');

        // Scroll to the athlete in the leaderboard container
        setTimeout(() => {
            const leaderboardItems = document.querySelectorAll('#leaderboard-list .leaderboard-item');
            if (leaderboardItems[rank - 1]) {
                leaderboardItems[rank - 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                leaderboardItems[rank - 1].style.boxShadow = '0 0 35px var(--accent-color)';
                leaderboardItems[rank - 1].style.borderColor = 'var(--accent-color)';
            }
        }, 600);

        // Timeline:
        // 1. Hide popup after 8 seconds (lasts longer)
        setTimeout(() => {
            popup.classList.remove('show');
        }, 8000);

        // 2. Stay 5 seconds after popup hides (total 13s), then scroll smoothly back to the top of the leaderboard
        setTimeout(() => {
            const leaderboardContainer = document.getElementById('leaderboard-tab-content');
            if (leaderboardContainer) {
                leaderboardContainer.scrollTo({ top: 0, behavior: 'smooth' });
            }
            
            // Remove highlight glow
            const leaderboardItems = document.querySelectorAll('#leaderboard-list .leaderboard-item');
            if (leaderboardItems[rank - 1]) {
                leaderboardItems[rank - 1].style.boxShadow = '';
                leaderboardItems[rank - 1].style.borderColor = '';
            }
        }, 13000);
    }

    function showExitButton() {
        if (!document.body.classList.contains('tv-active')) return;
        exitTvBtn.style.opacity = '1';
        exitTvBtn.style.pointerEvents = 'auto';
        document.body.style.cursor = '';
        
        clearTimeout(tvButtonTimeout);
        tvButtonTimeout = setTimeout(hideExitButton, 3000);
    }

    function hideExitButton() {
        if (!document.body.classList.contains('tv-active')) return;
        exitTvBtn.style.opacity = '0';
        exitTvBtn.style.pointerEvents = 'none';
        document.body.style.cursor = 'none';
    }

    function handleTVActivity() {
        if (document.body.classList.contains('tv-active')) {
            showExitButton();
        }
    }

    function handleTVScrollingMode(mode) {
        if (!document.body.classList.contains('tv-active')) return;

        if (mode === 'active') {
            stopTVScrolling();
            
            setTimeout(() => {
                const startlistContainer = document.getElementById('startlist-tab-content');
                const startlistList = document.getElementById('startlist-list');
                if (!startlistContainer || !startlistList) return;
                
                const nextUpElement = startlistList.querySelector('.leaderboard-item .status-badge.pending')?.closest('.leaderboard-item');
                let targetScrollY = 0;
                
                if (nextUpElement) {
                    targetScrollY = (nextUpElement.offsetTop + nextUpElement.offsetHeight / 2) - startlistContainer.clientHeight / 2;
                    const maxScroll = startlistList.offsetHeight - startlistContainer.clientHeight;
                    if (targetScrollY < 0) targetScrollY = 0;
                    if (targetScrollY > maxScroll) targetScrollY = maxScroll;
                }
                
                startlistList.style.transition = 'transform 1s cubic-bezier(0.16, 1, 0.3, 1)';
                startlistList.style.transform = `translate3d(0, ${-targetScrollY}px, 0)`;
            }, 100);
        } else {
            if (!tvScrollRAF) {
                startTVScrolling();
            }
        }
    }

    function enterTVMode() {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen().catch(() => {});
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }

        document.body.classList.add('tv-active');
        tabContainer.classList.add('hidden');
        footer.classList.add('hidden');
        contentLeaderboard.classList.remove('hidden');
        contentStartlist.classList.add('hidden');
        document.querySelector('main').classList.remove('split-view');
        document.querySelector('.container').classList.remove('split-container');
        if (tvFeatureEl) tvFeatureEl.classList.remove('hidden');
        exitTvBtn.classList.remove('hidden');
        exitTvBtn.style.opacity = '1';
        exitTvBtn.style.pointerEvents = 'auto';
        document.body.style.cursor = '';
        showExitButton();
        setTimeout(loadData, 1000); // Wait for split animation and settle
    }

    function exitTVMode() {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }

        document.body.classList.remove('tv-active');
        if (tvFeatureEl) tvFeatureEl.classList.add('hidden');
        tabContainer.classList.remove('hidden');
        footer.classList.remove('hidden');
        exitTvBtn.classList.add('hidden');
        exitTvBtn.style.opacity = '';
        exitTvBtn.style.pointerEvents = '';
        document.body.style.cursor = '';
        clearTimeout(tvButtonTimeout);
        stopTVScrolling();
    }

    if (tvModeBtn) {
        tvModeBtn.addEventListener('click', enterTVMode);
    }
    if (exitTvBtn) {
        exitTvBtn.addEventListener('click', exitTVMode);
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            document.body.classList.remove('tv-active');
            if (tvFeatureEl) tvFeatureEl.classList.add('hidden');
            tabContainer.classList.remove('hidden');
            footer.classList.remove('hidden');
            exitTvBtn.classList.add('hidden');
            exitTvBtn.style.opacity = '';
            exitTvBtn.style.pointerEvents = '';
            document.body.style.cursor = '';
            clearTimeout(tvButtonTimeout);
            stopTVScrolling();
        }
    });

    if (exitTvBtn) {
        document.addEventListener('mousemove', handleTVActivity);
        document.addEventListener('mousedown', handleTVActivity);
        document.addEventListener('touchstart', handleTVActivity);
        document.addEventListener('keydown', handleTVActivity);
    }

    async function loadData() {
        try {
            const [data, cfg] = await Promise.all([
                fetchAPI('/leaderboard'),
                fetchAPI('/config')
            ]);
            applyBrandingVisibility(cfg.isLicensed);
            applyAppName(cfg.appName);
            applyAppIcon(cfg.appIconUrl);
            
            if (!cfg.isLicensed) {
                showLicenseLockOverlay();
                return;
            } else {
                const overlay = document.getElementById('license-lock-overlay');
                if (overlay) overlay.remove();
            }

            renderLeaderboard(data);
            renderStartlist(data);
            renderTVFeature(data);

            if (document.body.classList.contains('tv-active') && !tvFeatureEl) {
                handleTVScrollingMode(cfg.tvScrollMode);
            }

            const completed = data.filter(a => a.completed === 1);
            if (!firstLoadCompleted) {
                firstLoadCompleted = true;
                completed.forEach((athlete, index) => {
                    completedAthletesCache.set(athlete.id, {
                        name: athlete.name,
                        score: athlete.total_score,
                        rank: index + 1
                    });
                });
            } else {
                let newlyCompleted = [];
                let updatedScores = [];

                completed.forEach((athlete, index) => {
                    const rank = index + 1;
                    const cached = completedAthletesCache.get(athlete.id);

                    if (!cached) {
                        newlyCompleted.push({ athlete, rank });
                    } else if (cached.score !== athlete.total_score) {
                        updatedScores.push({ athlete, rank });
                    }

                    // Update local cache
                    completedAthletesCache.set(athlete.id, {
                        name: athlete.name,
                        score: athlete.total_score,
                        rank: rank
                    });
                });

                // Trigger announcements if TV Mode is active
                if (document.body.classList.contains('tv-active')) {
                    if (newlyCompleted.length > 0) {
                        const { athlete, rank } = newlyCompleted[0];
                        triggerTVAnnouncement(athlete.name, athlete.total_score, rank, 'Run Completed!');
                    } else if (updatedScores.length > 0) {
                        const { athlete, rank } = updatedScores[0];
                        triggerTVAnnouncement(athlete.name, athlete.total_score, rank, 'Score Updated!');
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load leaderboard data', e);
        }
    }

    function renderLeaderboard(data) {
        leaderboardListEl.innerHTML = '';
        const completed = data.filter(a => a.completed === 1);
        
        if (completed.length === 0) {
            noLeaderboardEl.classList.remove('hidden');
            return;
        }
        noLeaderboardEl.classList.add('hidden');

        completed.forEach((athlete, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <div class="rank">#${index + 1}</div>
                <div class="name">${athlete.name}${renderTimeLabel(athlete)}</div>
                <div class="score">${athlete.total_score} pts</div>
            `;
            leaderboardListEl.appendChild(item);
        });
    }

    function renderStartlist(data) {
        startlistListEl.innerHTML = '';
        if (data.length === 0) {
            noStartlistEl.classList.remove('hidden');
            return;
        }
        noStartlistEl.classList.add('hidden');

        // Sort all athletes by order_index ASC
        const sortedByOrder = [...data].sort((a, b) => a.order_index - b.order_index);

        sortedByOrder.forEach((athlete) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            const statusLabel = athlete.completed 
                ? '<span class="status-badge completed">Finished</span>' 
                : '<span class="status-badge pending">Next Up</span>';

            item.innerHTML = `
                <div class="rank" style="color: var(--accent-color); font-weight: 700; width: 5.5rem;">N° ${athlete.order_index}</div>
                <div class="name">${athlete.name}${renderTimeLabel(athlete)} ${statusLabel}</div>
                <div class="score" style="font-size: 1.1rem; opacity: 0.7;">${athlete.completed ? athlete.total_score + ' pts' : '-'}</div>
            `;
            startlistListEl.appendChild(item);
        });
    }

    function renderTimeLabel(athlete) {
        const time = Number(athlete.time_seconds);
        if (!Number.isFinite(time)) return '';
        return `<span class="leaderboard-time">${time.toFixed(2)}s</span>`;
    }

    function renderTVFeature(data) {
        if (!tvFeatureEl) return;
        const active = [...data]
            .sort((a, b) => a.order_index - b.order_index)
            .find(athlete => athlete.completed !== 1);

        if (!active) {
            tvNameEl.textContent = 'No active athlete';
            tvCountryEl.textContent = 'Competition finished';
            tvPhotoEl.classList.add('hidden');
            tvPhotoPlaceholderEl.classList.remove('hidden');
            tvPhotoPlaceholderEl.textContent = 'Finished';
            return;
        }

        tvNameEl.textContent = active.name;
        const flag = countryFlag(active.country);
        tvCountryEl.textContent = active.country ? `${flag ? flag + ' ' : ''}${active.country}` : '';

        if (active.image_url) {
            tvPhotoEl.src = active.image_url;
            tvPhotoEl.classList.remove('hidden');
            tvPhotoPlaceholderEl.classList.add('hidden');
        } else {
            tvPhotoEl.classList.add('hidden');
            tvPhotoPlaceholderEl.classList.remove('hidden');
            tvPhotoPlaceholderEl.textContent = active.name ? active.name.slice(0, 1).toUpperCase() : 'No Photo';
        }
    }

    loadData();
    socket.on('state-update', loadData);
}

// --- Judge Logic ---
function initJudge() {
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const scoreInputEl = document.getElementById('score-input');
    const timeInputEl = document.getElementById('time-input');
    
    if (scoreInputEl) {
        scoreInputEl.addEventListener('input', () => {
            const activeAthleteId = scoreInputEl.dataset.athleteId;
            if (activeAthleteId && judge) {
                localStorage.setItem(`draft_score_${judge.id}_${activeAthleteId}`, scoreInputEl.value);
            }
        });
    }
    if (timeInputEl) {
        timeInputEl.addEventListener('input', () => {
            const activeAthleteId = timeInputEl.dataset.athleteId;
            if (activeAthleteId && judge) {
                localStorage.setItem(`draft_time_${judge.id}_${activeAthleteId}`, timeInputEl.value);
            }
        });
    }
    
    // Check session
    const judgeStr = sessionStorage.getItem('judge');
    let judge = judgeStr ? JSON.parse(judgeStr) : null;
    let numJudges = 6;
    let judgeConfig = {};

    function isTimeJudge() {
        return judge && String(judgeConfig.timeJudgeId || '') === String(judge.id);
    }

    function configureScoreInput() {
        const labelEl = document.querySelector('label[for="score-input"]');
        const editLabelEl = document.querySelector('label[for="edit-score-input"]');
        const scoreInput = document.getElementById('score-input');
        const editScoreInput = document.getElementById('edit-score-input');
        const timeContainer = document.querySelector('.time-input-container');
        const editTimeGroup = document.querySelector('.edit-time-group');

        if (labelEl) labelEl.textContent = 'Your Score';
        if (editLabelEl) editLabelEl.textContent = 'New Score';
        [scoreInput, editScoreInput].forEach(input => {
            if (!input) return;
            input.min = '0';
            input.step = '1';
            input.max = '100';
        });
        if (timeContainer) timeContainer.classList.toggle('hidden', !isTimeJudge());
        if (editTimeGroup) editTimeGroup.classList.toggle('hidden', !isTimeJudge());
    }

    async function loadConfig() {
        try {
            const cfg = await fetchAPI('/config');
            judgeConfig = cfg;
            numJudges = cfg.numJudges;
            applyBrandingVisibility(cfg.isLicensed);
            applyAppName(cfg.appName);
            applyAppIcon(cfg.appIconUrl);
            configureScoreInput();
            
            if (!cfg.isLicensed) {
                showLicenseLockOverlay();
                dashboardView.classList.add('hidden');
                loginView.classList.add('hidden');
                return;
            } else {
                const overlay = document.getElementById('license-lock-overlay');
                if (overlay) overlay.remove();
                
                if (judge) {
                    showDashboard();
                } else {
                    loginView.classList.remove('hidden');
                }
            }
        } catch(e) {}
    }
    loadConfig();

    if (judge) {
        showDashboard();
    }

    // Login Form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const pin = document.getElementById('pin').value;
        const errorEl = document.getElementById('login-error');

        try {
            const res = await fetchAPI('/login', 'POST', { username, pin });
            if (res.role === 'judge') {
                judge = { id: res.id, username: res.username };
                sessionStorage.setItem('judge', JSON.stringify(judge));
                showDashboard();
            } else {
                errorEl.textContent = 'Not a judge account';
                errorEl.classList.remove('hidden');
            }
        } catch (e) {
            errorEl.textContent = e.message;
            errorEl.classList.remove('hidden');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('judge');
        judge = null;
        dashboardView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    function showDashboard() {
        loginView.classList.add('hidden');
        dashboardView.classList.remove('hidden');
        document.getElementById('judge-name-display').textContent = judge.username;
        configureScoreInput();
        loadDashboardData();
    }

    async function loadDashboardData() {
        if (!judge) return;

        try {
            const [currentAthlete, allAthletes] = await Promise.all([
                fetchAPI('/current-athlete'),
                fetchAPI('/athletes')
            ]);
            
            renderCurrentAthlete(currentAthlete);
            renderPastAthletes(allAthletes);
        } catch (e) {
            console.error(e);
        }
    }

    async function renderCurrentAthlete(athlete) {
        const nameEl = document.getElementById('athlete-name');
        const inputContainer = document.querySelector('.score-input-container');
        const submitBtn = document.getElementById('submit-score-btn');
        const statusBar = document.getElementById('status-bar');
        const scoreStatus = document.getElementById('score-status');
        const scoreInputEl = document.getElementById('score-input');
        const timeInputEl = document.getElementById('time-input');

        if (!athlete) {
            nameEl.textContent = 'No active athlete at the moment.';
            inputContainer.style.display = 'none';
            submitBtn.style.display = 'none';
            statusBar.innerHTML = 'Competition finished or no athletes added.';
            scoreStatus.classList.add('hidden');
            if (scoreInputEl) {
                delete scoreInputEl.dataset.athleteId;
            }
            if (timeInputEl) {
                delete timeInputEl.dataset.athleteId;
            }
            return;
        }

        nameEl.textContent = athlete.name;
        inputContainer.style.display = 'block';
        submitBtn.style.display = 'block';
        if (scoreInputEl) {
            scoreInputEl.dataset.athleteId = athlete.id;
        }
        if (timeInputEl) {
            timeInputEl.dataset.athleteId = athlete.id;
        }
        configureScoreInput();

        const submittedCount = athlete.submittedJudgeIds ? athlete.submittedJudgeIds.length : 0;
        const hasSubmitted = athlete.submittedJudgeIds && athlete.submittedJudgeIds.includes(judge.id);

        statusBar.innerHTML = `Scores submitted: ${submittedCount} / ${numJudges}`;

        const draftScore = localStorage.getItem(`draft_score_${judge.id}_${athlete.id}`);
        const draftTime = localStorage.getItem(`draft_time_${judge.id}_${athlete.id}`);

        if (hasSubmitted) {
            submitBtn.textContent = isTimeJudge() ? 'Update Score + Time' : 'Update Score';
            submitBtn.classList.remove('btn-primary');
            submitBtn.classList.add('btn-secondary');
            submitBtn.disabled = false;
            
            if (draftScore !== null) {
                if (scoreInputEl) scoreInputEl.value = draftScore;
            } else {
                // Try to fetch my current score
                try {
                    const myScore = await fetchAPI(`/scores/${athlete.id}/${judge.id}`);
                    if (myScore.score !== null) {
                        // Check again in case user typed something while fetch was running
                        if (localStorage.getItem(`draft_score_${judge.id}_${athlete.id}`) === null) {
                            if (scoreInputEl) scoreInputEl.value = myScore.score;
                        }
                        if (isTimeJudge() && localStorage.getItem(`draft_time_${judge.id}_${athlete.id}`) === null) {
                            if (timeInputEl) timeInputEl.value = myScore.time_seconds ?? '';
                        }
                    }
                } catch(e) {}
            }
            if (isTimeJudge() && draftTime !== null && timeInputEl) {
                timeInputEl.value = draftTime;
            }
            
            scoreStatus.textContent = isTimeJudge() ? 'You have already submitted a score and time.' : 'You have already submitted a score.';
            scoreStatus.classList.remove('hidden');
            scoreStatus.className = 'status-text success';
        } else {
            submitBtn.textContent = isTimeJudge() ? 'Submit Score + Time' : 'Submit Score';
            submitBtn.classList.add('btn-primary');
            submitBtn.classList.remove('btn-secondary');
            submitBtn.disabled = false;
            
            if (draftScore !== null) {
                if (scoreInputEl) scoreInputEl.value = draftScore;
            } else {
                if (scoreInputEl) scoreInputEl.value = '';
            }
            if (isTimeJudge() && timeInputEl) {
                timeInputEl.value = draftTime !== null ? draftTime : '';
            }
            scoreStatus.classList.add('hidden');
        }

        submitBtn.onclick = async () => {
            if (!scoreInputEl) return;
            const rawValue = scoreInputEl.value.trim();
            const score = Number(rawValue);
            if (rawValue === '') return alert('Please enter a valid score');
            if (!Number.isFinite(score)) return alert('Please enter a valid score');

            let timeSeconds = null;
            if (isTimeJudge()) {
                const rawTime = timeInputEl ? timeInputEl.value.trim() : '';
                timeSeconds = Number(rawTime);
                if (rawTime === '' || !Number.isFinite(timeSeconds) || timeSeconds < 0) {
                    return alert('Please enter a valid time in seconds');
                }
            }

            submitBtn.disabled = true;
            try {
                await fetchAPI('/submit-score', 'POST', {
                    athleteId: athlete.id,
                    judgeId: judge.id,
                    score,
                    timeSeconds
                });
                localStorage.removeItem(`draft_score_${judge.id}_${athlete.id}`);
                localStorage.removeItem(`draft_time_${judge.id}_${athlete.id}`);
                scoreInputEl.value = '';
                if (timeInputEl) timeInputEl.value = '';
                // The socket update will trigger a reload
            } catch(e) {
                alert(e.message);
                submitBtn.disabled = false;
            }
        };
    }

    async function renderPastAthletes(athletes) {
        const listEl = document.getElementById('athletes-list');
        listEl.innerHTML = '';
        
        // We want to show all athletes so they can edit their scores.
        if (athletes.length === 0) {
            listEl.innerHTML = '<p class="text-sm">No athletes added yet.</p>';
            return;
        }

        // Fetch my scores for all athletes to show what I gave
        // We could make a bulk endpoint, but for simplicity, we'll just show edit buttons and fetch on click.
        for (const athlete of athletes) {
            const item = document.createElement('div');
            item.className = 'athlete-list-item flex-between';
            item.innerHTML = `
                <div>
                    <span class="font-bold">${athlete.name}</span>
                    <span class="status-badge ${athlete.completed ? 'completed' : 'pending'}">${athlete.completed ? 'Completed' : 'Pending'}</span>
                </div>
                <button class="btn-secondary btn-small edit-btn" data-id="${athlete.id}" data-name="${athlete.name}">${isTimeJudge() ? 'Edit Score + Time' : 'Edit Score'}</button>
            `;
            listEl.appendChild(item);
        }

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const athleteId = e.target.getAttribute('data-id');
                const athleteName = e.target.getAttribute('data-name');
                openEditModal(athleteId, athleteName);
            });
        });
    }

    async function openEditModal(athleteId, athleteName) {
        document.getElementById('edit-athlete-id').value = athleteId;
        document.getElementById('edit-athlete-name').textContent = athleteName;
        document.getElementById('edit-score-input').value = '';
        document.getElementById('edit-time-input').value = '';
        document.querySelector('#edit-modal h3').textContent = isTimeJudge() ? 'Edit Score + Time' : 'Edit Score';
        document.getElementById('save-edit-btn').textContent = isTimeJudge() ? 'Save Score + Time' : 'Save Score';
        configureScoreInput();
        
        try {
            const myScore = await fetchAPI(`/scores/${athleteId}/${judge.id}`);
            if (myScore.score !== null) {
                document.getElementById('edit-score-input').value = myScore.score;
            }
            if (isTimeJudge() && myScore.time_seconds !== null && myScore.time_seconds !== undefined) {
                document.getElementById('edit-time-input').value = myScore.time_seconds;
            }
        } catch(e) {}

        document.getElementById('edit-modal').classList.remove('hidden');
    }

    document.getElementById('cancel-edit-btn').addEventListener('click', () => {
        document.getElementById('edit-modal').classList.add('hidden');
    });

    document.getElementById('save-edit-btn').addEventListener('click', async () => {
        const athleteId = document.getElementById('edit-athlete-id').value;
        const rawValue = document.getElementById('edit-score-input').value.trim();
        const score = Number(rawValue);
        if (rawValue === '') return alert('Please enter a valid score');
        if (!Number.isFinite(score)) return alert('Please enter a valid score');

        let timeSeconds = null;
        if (isTimeJudge()) {
            const rawTime = document.getElementById('edit-time-input').value.trim();
            timeSeconds = Number(rawTime);
            if (rawTime === '' || !Number.isFinite(timeSeconds) || timeSeconds < 0) {
                return alert('Please enter a valid time in seconds');
            }
        }

        try {
            await fetchAPI('/update-score', 'PUT', {
                athleteId,
                judgeId: judge.id,
                score,
                timeSeconds
            });
            document.getElementById('edit-modal').classList.add('hidden');
            // Socket will reload data
        } catch(e) {
            alert(e.message);
        }
    });

    socket.on('state-update', loadDashboardData);
}

// --- Admin Logic ---
function initAdmin() {
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const adminControlsTab = document.getElementById('tab-admin-controls');
    const adminDatabaseTab = document.getElementById('tab-admin-database');
    const adminControlsContent = document.getElementById('admin-controls-tab-content');
    const adminDatabaseContent = document.getElementById('admin-database-tab-content');
    let adminConfig = {};
    let adminJudges = [];

    checkBranding();

    const adminStr = sessionStorage.getItem('admin');
    if (adminStr === 'true') {
        showAdminView();
    }

    document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('admin-pin').value;
        const errorEl = document.getElementById('login-error');

        try {
            const res = await fetchAPI('/login', 'POST', { username: 'admin', pin });
            if (res.role === 'admin') {
                sessionStorage.setItem('admin', 'true');
                showAdminView();
            } else {
                throw new Error('Not admin');
            }
        } catch (e) {
            errorEl.textContent = 'Invalid admin PIN';
            errorEl.classList.remove('hidden');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        sessionStorage.removeItem('admin');
        adminView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    function showAdminView() {
        loginView.classList.add('hidden');
        adminView.classList.remove('hidden');
        loadDashboardData();
    }

    async function loadDashboardData() {
        await loadJudges();
        await Promise.all([
            loadAthletes(),
            loadConfigSettings()
        ]);
    }

    if (adminControlsTab && adminDatabaseTab && adminControlsContent && adminDatabaseContent) {
        adminControlsTab.addEventListener('click', () => {
            adminControlsTab.classList.add('active');
            adminDatabaseTab.classList.remove('active');
            adminControlsContent.classList.remove('hidden');
            adminDatabaseContent.classList.add('hidden');
            adminView.classList.remove('wide-container');
        });

        adminDatabaseTab.addEventListener('click', () => {
            adminDatabaseTab.classList.add('active');
            adminControlsTab.classList.remove('active');
            adminDatabaseContent.classList.remove('hidden');
            adminControlsContent.classList.add('hidden');
            adminView.classList.add('wide-container');
            loadDatabaseView();
        });
    }

    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[char]));
    }

    async function loadDatabaseView() {
        const container = document.getElementById('admin-database-view');
        if (!container) return;

        try {
            const data = await fetchAPI('/admin/database');
            const roundSnapshots = [
                { key: 'qualification', label: 'Qualification', data: data.qualification || {} },
                { key: 'finals', label: 'Finals', data: data.finals || {} }
            ];
            const allJudges = (data.qualification && data.qualification.judges) || (data.finals && data.finals.judges) || [];
            const hasAnyData = roundSnapshots.some(snapshot => {
                const roundData = snapshot.data;
                return (roundData.athletes || []).length || (roundData.scores || []).length;
            }) || allJudges.length;

            if (!hasAnyData) {
                container.innerHTML = '<p class="text-sm">The database is empty.</p>';
                return;
            }

            const judgeRows = allJudges.map(judge => `
                <tr>
                    <td>${escapeHTML(judge.id)}</td>
                    <td>${escapeHTML(judge.username)}</td>
                    <td>${escapeHTML(judge.pin)}</td>
                </tr>
            `).join('');

            const roundSections = roundSnapshots.map(snapshot => {
                const roundData = snapshot.data;
                const judges = roundData.judges || allJudges;
                const athletes = roundData.athletes || [];
                const scores = roundData.scores || [];
                const times = roundData.times || [];
                const matrix = roundData.matrix || [];

                const matrixHeader = judges.map(judge => `<th>${escapeHTML(judge.username)}<span class="db-table-meta">#${judge.id}</span></th>`).join('');
                const matrixRows = matrix.map(row => {
                    const scoreCells = row.scores.map(score => `
                        <td>
                            ${score.score === null ? '<span class="db-empty">-</span>' : escapeHTML(score.score)}
                            ${score.time_seconds === null ? '' : `<span class="db-table-meta">${escapeHTML(score.time_seconds)}s</span>`}
                        </td>
                    `).join('');
                    return `
                        <tr>
                            <th>N° ${escapeHTML(row.order_index)} ${escapeHTML(row.athlete_name)}<span class="db-table-meta">#${row.athlete_id} ${row.completed ? 'completed' : 'pending'}</span></th>
                            ${scoreCells}
                        </tr>
                    `;
                }).join('');

                const athleteRows = athletes.map(athlete => `
                    <tr>
                        <td>${escapeHTML(athlete.id)}</td>
                        <td>${escapeHTML(athlete.name)}</td>
                        <td>${escapeHTML(athlete.order_index)}</td>
                        <td>${athlete.completed ? 'Yes' : 'No'}</td>
                    </tr>
                `).join('');

                const scoreRows = scores.map(score => `
                    <tr>
                        <td>${escapeHTML(score.id)}</td>
                        <td>${escapeHTML(score.athlete_name || 'Missing athlete')} <span class="db-table-meta">#${escapeHTML(score.athlete_id)}</span></td>
                        <td>${escapeHTML(score.judge_name || 'Missing judge')} <span class="db-table-meta">#${escapeHTML(score.judge_id)}</span></td>
                        <td>${escapeHTML(score.score)}</td>
                    </tr>
                `).join('');

                const timeRows = times.map(time => `
                    <tr>
                        <td>${escapeHTML(time.id)}</td>
                        <td>${escapeHTML(time.athlete_name || 'Missing athlete')} <span class="db-table-meta">#${escapeHTML(time.athlete_id)}</span></td>
                        <td>${escapeHTML(time.judge_name || 'Missing judge')} <span class="db-table-meta">#${escapeHTML(time.judge_id)}</span></td>
                        <td>${escapeHTML(time.time_seconds)}s</td>
                    </tr>
                `).join('');

                return `
                    <div class="db-round">
                        <div class="flex-between mb-4">
                            <h4>${snapshot.label}</h4>
                            <span class="status-badge ${data.currentRound === snapshot.key ? 'completed' : 'pending'}">${data.currentRound === snapshot.key ? 'Current' : 'Inactive'}</span>
                        </div>
                        <div class="db-section">
                            <h4>Scores by Athlete and Judge</h4>
                            <div class="db-table-wrap">
                                <table class="db-table">
                                    <thead>
                                        <tr>
                                            <th>Athlete</th>
                                            ${matrixHeader}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${matrixRows || '<tr><td colspan="999">No athletes in this round.</td></tr>'}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="db-grid">
                            <div class="db-section">
                                <h4>Athletes</h4>
                                <div class="db-table-wrap">
                                    <table class="db-table">
                                        <thead><tr><th>ID</th><th>Name</th><th>Order</th><th>Completed</th></tr></thead>
                                        <tbody>${athleteRows || '<tr><td colspan="4">No athletes.</td></tr>'}</tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="db-section">
                                <h4>Scores Table</h4>
                                <div class="db-table-wrap">
                                    <table class="db-table">
                                        <thead><tr><th>ID</th><th>Athlete</th><th>Judge</th><th>Score</th></tr></thead>
                                        <tbody>${scoreRows || '<tr><td colspan="4">No scores submitted yet.</td></tr>'}</tbody>
                                    </table>
                                </div>
                            </div>

                            <div class="db-section">
                                <h4>Times Table</h4>
                                <div class="db-table-wrap">
                                    <table class="db-table">
                                        <thead><tr><th>ID</th><th>Athlete</th><th>Judge</th><th>Time</th></tr></thead>
                                        <tbody>${timeRows || '<tr><td colspan="4">No times submitted yet.</td></tr>'}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            container.innerHTML = `
                <div class="db-section">
                    <h4>Judges</h4>
                    <div class="db-table-wrap">
                        <table class="db-table">
                            <thead><tr><th>ID</th><th>Name</th><th>PIN</th></tr></thead>
                            <tbody>${judgeRows || '<tr><td colspan="3">No judges.</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>
                ${roundSections}
            `;
        } catch(e) {
            container.innerHTML = `<p class="error">Failed to load database: ${escapeHTML(e.message)}</p>`;
        }
    }

    async function loadConfigSettings() {
        try {
            const cfg = await fetchAPI('/config');
            adminConfig = cfg;
            applyBrandingVisibility(cfg.isLicensed);
            applyAppName(cfg.appName);
            applyAppIcon(cfg.appIconUrl);
            updateLicenseUI(cfg);
            const appNameEl = document.getElementById('app-name-input');
            if (appNameEl && cfg.appName) {
                appNameEl.value = cfg.appName;
            }
            const selectEl = document.getElementById('tv-scroll-mode-select');
            if (selectEl && cfg.tvScrollMode) {
                selectEl.value = cfg.tvScrollMode;
            }
            const formulaEl = document.getElementById('scoring-formula-select');
            if (formulaEl && cfg.scoringFormula) {
                formulaEl.value = cfg.scoringFormula;
            }
            const currentRoundEl = document.getElementById('current-round-select');
            if (currentRoundEl && cfg.currentRound) {
                currentRoundEl.value = cfg.currentRound;
            }
            const finalistsCountEl = document.getElementById('finalists-count-input');
            if (finalistsCountEl && cfg.finalistsCount) {
                finalistsCountEl.value = cfg.finalistsCount;
            }
            const timeMinEl = document.getElementById('time-min-input');
            if (timeMinEl) {
                timeMinEl.value = cfg.timeMinSeconds || cfg.timeThresholdSeconds || '15';
            }
            const timeMaxEl = document.getElementById('time-max-input');
            if (timeMaxEl) {
                timeMaxEl.value = cfg.timeMaxSeconds || '45';
            }
            const timeDeductionEl = document.getElementById('time-deduction-input');
            if (timeDeductionEl) {
                timeDeductionEl.value = cfg.timeDeductionPoints || '0';
            }
            renderTimeJudgeOptions();
        } catch(e) {
            console.error('Failed to load config', e);
        }
    }

    function renderTimeJudgeOptions() {
        const selectEl = document.getElementById('time-judge-select');
        if (!selectEl) return;

        const currentValue = String(adminConfig.timeJudgeId || selectEl.value || '');
        selectEl.innerHTML = '<option value="">No time judge</option>' + adminJudges.map(judge => (
            `<option value="${escapeHTML(judge.id)}">${escapeHTML(judge.username)}</option>`
        )).join('');
        selectEl.value = adminJudges.some(judge => String(judge.id) === currentValue) ? currentValue : '';
    }

    async function loadAthletes() {
        try {
            const athletes = await fetchAPI('/athletes');
            const listEl = document.getElementById('admin-athletes-list');
            listEl.innerHTML = '';

            if (athletes.length === 0) {
                listEl.innerHTML = '<p class="text-sm">No athletes added yet.</p>';
                return;
            }

            const sortedByOrder = [...athletes].sort((a, b) => a.order_index - b.order_index);

            sortedByOrder.forEach(athlete => {
                const item = document.createElement('div');
                item.className = 'athlete-list-item flex-between';
                item.setAttribute('draggable', 'true');
                item.setAttribute('data-id', athlete.id);
                item.style.cursor = 'grab';
                item.style.gap = '1rem';
                item.style.padding = '0.75rem 1rem';
                item.style.marginBottom = '0.5rem';
                item.style.background = 'rgba(255, 255, 255, 0.03)';
                item.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                item.style.borderRadius = '12px';
                const flag = countryFlag(athlete.country);
                const imageUrl = athlete.image_url || '';
                const imageLinkValue = /^https?:\/\//i.test(imageUrl) ? imageUrl : '';
                
                item.innerHTML = `
                    <div class="admin-athlete-media">
                        ${imageUrl ? `<img src="${escapeHTML(imageUrl)}" alt="" class="admin-athlete-thumb">` : '<div class="admin-athlete-thumb placeholder">Photo</div>'}
                    </div>
                    <div class="admin-athlete-fields flex-grow">
                        <div class="flex-row" style="align-items: center; gap: 0.5rem;">
                            <span style="color: rgba(255, 255, 255, 0.3); font-size: 1.25rem; cursor: grab; user-select: none;">☰</span>
                            <div class="rank" style="color: var(--accent-color); font-weight: 700; width: 4.5rem; text-align: center;">N° ${athlete.order_index}</div>
                        </div>
                        <input type="text" class="athlete-name-input" value="${escapeHTML(athlete.name)}" placeholder="Athlete Name">
                        <input type="text" class="athlete-country-input" value="${escapeHTML(athlete.country || '')}" placeholder="Country">
                        <span class="athlete-flag-preview">${flag}</span>
                        <input type="url" class="athlete-image-url-input" value="${escapeHTML(imageLinkValue)}" placeholder="Image URL">
                    </div>
                    <div class="admin-athlete-actions">
                        <input type="file" class="athlete-image-input hidden" accept="image/png,image/jpeg,image/gif,image/webp">
                        <button class="btn-secondary btn-small upload-athlete-image-btn" data-id="${athlete.id}">Photo</button>
                        <button class="btn-secondary btn-small save-athlete-image-url-btn" data-id="${athlete.id}">Save Link</button>
                        <button class="btn-primary btn-small import-athlete-image-url-btn" data-id="${athlete.id}">Import URL</button>
                        <button class="btn-primary btn-small save-athlete-btn" data-id="${athlete.id}" data-order="${athlete.order_index}">Save</button>
                        <button class="btn-danger btn-small delete-btn" data-id="${athlete.id}">Remove</button>
                    </div>
                `;
                listEl.appendChild(item);
            });

            document.querySelectorAll('.athlete-country-input').forEach(input => {
                input.addEventListener('input', () => {
                    const item = input.closest('.athlete-list-item');
                    const preview = item.querySelector('.athlete-flag-preview');
                    if (preview) preview.textContent = countryFlag(input.value);
                });
                input.addEventListener('blur', () => {
                    input.value = normalizeCountryName(input.value);
                    const item = input.closest('.athlete-list-item');
                    const preview = item.querySelector('.athlete-flag-preview');
                    if (preview) preview.textContent = countryFlag(input.value);
                });
            });

            document.querySelectorAll('.save-athlete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const currentOrder = e.target.getAttribute('data-order');
                    const item = e.target.closest('.athlete-list-item');
                    const name = item.querySelector('.athlete-name-input').value.trim();
                    const countryInput = item.querySelector('.athlete-country-input');
                    const country = normalizeCountryName(countryInput.value);
                    countryInput.value = country;
                    if (!name) return alert('Name cannot be empty');

                    try {
                        await fetchAPI(`/admin/update-athlete/${id}`, 'PUT', { name, country, order_index: currentOrder });
                        await loadAthletes();
                    } catch(e) {
                        alert(e.message);
                    }
                });
            });

            document.querySelectorAll('.upload-athlete-image-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const item = e.target.closest('.athlete-list-item');
                    item.querySelector('.athlete-image-input').click();
                });
            });

            document.querySelectorAll('.athlete-image-input').forEach(input => {
                input.addEventListener('change', async () => {
                    const file = input.files && input.files[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) return alert('Athlete image must be 5 MB or smaller');
                    const item = input.closest('.athlete-list-item');
                    const id = item.getAttribute('data-id');

                    try {
                        const res = await fetch(`/admin/athlete-image/${id}`, {
                            method: 'POST',
                            headers: { 'Content-Type': file.type },
                            body: file
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || data.message || 'Image upload failed');
                        await loadAthletes();
                    } catch(e) {
                        alert('Failed to upload athlete image: ' + e.message);
                    } finally {
                        input.value = '';
                    }
                });
            });

            async function saveAthleteImageUrl(button, importImage) {
                const item = button.closest('.athlete-list-item');
                const id = item.getAttribute('data-id');
                const imageUrlInput = item.querySelector('.athlete-image-url-input');
                const imageUrl = imageUrlInput.value.trim();
                if (importImage && !imageUrl) return alert('Enter an image URL first');

                button.disabled = true;
                try {
                    const result = await fetchAPI(`/admin/athlete-image-url/${id}`, 'PUT', {
                        imageUrl,
                        importImage
                    });
                    if (!importImage && !imageUrl) {
                        alert('Image cleared.');
                    } else if (importImage) {
                        alert('Image imported into the database.');
                    }
                    if (result.imageUrl && /^https?:\/\//i.test(result.imageUrl)) {
                        imageUrlInput.value = result.imageUrl;
                    }
                    await loadAthletes();
                } catch(e) {
                    alert((importImage ? 'Failed to import image: ' : 'Failed to save image link: ') + e.message);
                } finally {
                    button.disabled = false;
                }
            }

            document.querySelectorAll('.save-athlete-image-url-btn').forEach(btn => {
                btn.addEventListener('click', () => saveAthleteImageUrl(btn, false));
            });

            document.querySelectorAll('.import-athlete-image-url-btn').forEach(btn => {
                btn.addEventListener('click', () => saveAthleteImageUrl(btn, true));
            });

            // HTML5 Drag and Drop listeners
            listEl.addEventListener('dragstart', (e) => {
                const item = e.target.closest('.athlete-list-item');
                if (item) {
                    item.classList.add('dragging');
                }
            });

            listEl.addEventListener('dragend', async (e) => {
                const item = e.target.closest('.athlete-list-item');
                if (item) {
                    item.classList.remove('dragging');
                    
                    const items = Array.from(listEl.querySelectorAll('.athlete-list-item'));
                    const orders = items.map((el, index) => {
                        return {
                            id: el.getAttribute('data-id'),
                            order_index: index + 1
                        };
                    });

                    try {
                        await fetchAPI('/admin/reorder-athletes', 'PUT', { orders });
                        await loadAthletes();
                    } catch (e) {
                        alert('Failed to save sequence: ' + e.message);
                    }
                }
            });

            listEl.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = listEl.querySelector('.dragging');
                if (!draggingItem) return;
                const afterElement = getDragAfterElement(listEl, e.clientY);
                if (afterElement == null) {
                    listEl.appendChild(draggingItem);
                } else {
                    listEl.insertBefore(draggingItem, afterElement);
                }
            });

            function getDragAfterElement(container, y) {
                const draggableElements = Array.from(container.querySelectorAll('.athlete-list-item:not(.dragging)'));
                return draggableElements.reduce((closest, child) => {
                    const box = child.getBoundingClientRect();
                    const offset = y - box.top - box.height / 2;
                    if (offset < 0 && offset > closest.offset) {
                        return { offset: offset, element: child };
                    } else {
                        return closest;
                    }
                }, { offset: Number.NEGATIVE_INFINITY }).element;
            }

            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    if(confirm('Are you sure you want to remove this athlete?')) {
                        await fetchAPI(`/admin/remove-athlete/${id}`, 'DELETE');
                        await loadAthletes();
                    }
                });
            });
        } catch(e) {
            console.error(e);
        }
    }

    async function loadJudges() {
        try {
            const judges = await fetchAPI('/admin/judges');
            adminJudges = judges;
            renderTimeJudgeOptions();
            const listEl = document.getElementById('admin-judges-list');
            listEl.innerHTML = '';

            if (judges.length === 0) {
                listEl.innerHTML = '<p class="text-sm">No judges added yet.</p>';
                return;
            }

            judges.forEach(judge => {
                const item = document.createElement('div');
                item.className = 'athlete-list-item flex-between';
                item.style.gap = '0.5rem';
                item.innerHTML = `
                    <div class="flex-row flex-grow" style="width: 100%;">
                        <input type="text" class="judge-name-input" value="${judge.username}" style="padding: 0.5rem; border-radius: 10px; font-weight: 600;" placeholder="Judge Name" class="flex-grow">
                        <input type="text" class="judge-pin-input" value="${judge.pin}" style="width: 100px; padding: 0.5rem; border-radius: 10px;" placeholder="PIN">
                    </div>
                    <div class="flex-row">
                        <button class="btn-primary btn-small save-judge-btn" data-id="${judge.id}">Save</button>
                        <button class="btn-danger btn-small delete-judge-btn" data-id="${judge.id}">Remove</button>
                    </div>
                `;
                listEl.appendChild(item);
            });

            document.querySelectorAll('.save-judge-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    const container = e.target.closest('.athlete-list-item');
                    const username = container.querySelector('.judge-name-input').value;
                    const pin = container.querySelector('.judge-pin-input').value;
                    if (!username || !pin) return alert('Username and PIN are required');

                    try {
                        await fetchAPI(`/admin/update-judge/${id}`, 'PUT', { username, pin });
                        alert('Judge updated!');
                    } catch(e) {
                        alert(e.message);
                    }
                });
            });

            document.querySelectorAll('.delete-judge-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    if(confirm('Are you sure you want to remove this judge?')) {
                        try {
                            await fetchAPI(`/admin/remove-judge/${id}`, 'DELETE');
                        } catch(e) {
                            alert(e.message);
                        }
                    }
                });
            });
        } catch(e) {
            console.error(e);
        }
    }

    document.getElementById('add-athlete-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('athlete-name-input');
        const countryInput = document.getElementById('athlete-country-input');
        const name = nameInput.value;
        const country = countryInput ? normalizeCountryName(countryInput.value) : '';
        if (countryInput) countryInput.value = country;
        if (!name) return;

        try {
            await fetchAPI('/admin/add-athlete', 'POST', { name, country });
            nameInput.value = '';
            if (countryInput) countryInput.value = '';
        } catch(e) {
            alert(e.message);
        }
    });

    const addAthleteCountryInput = document.getElementById('athlete-country-input');
    if (addAthleteCountryInput) {
        addAthleteCountryInput.addEventListener('blur', () => {
            addAthleteCountryInput.value = normalizeCountryName(addAthleteCountryInput.value);
        });
    }

    document.getElementById('add-judge-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameEl = document.getElementById('judge-username-input');
        const pinEl = document.getElementById('judge-pin-input');
        const username = usernameEl.value;
        const pin = pinEl.value;

        if (!username || !pin) return;

        try {
            await fetchAPI('/admin/add-judge', 'POST', { username, pin });
            usernameEl.value = '';
            pinEl.value = '';
        } catch(e) {
            alert(e.message);
        }
    });

    document.getElementById('load-preset-btn').addEventListener('click', async () => {
        if(confirm('This will replace the current startlist and scores with the 10 demo athletes. Continue?')) {
            try {
                await fetchAPI('/admin/load-preset', 'POST');
            } catch(e) {
                alert(e.message);
            }
        }
    });

    document.getElementById('reset-competition-btn').addEventListener('click', async () => {
        if(confirm('This will delete all athletes and scores. Are you absolutely sure?')) {
            try {
                await fetchAPI('/admin/reset', 'POST');
            } catch(e) {
                alert(e.message);
            }
        }
    });

    const downloadDatabaseBtn = document.getElementById('download-database-btn');
    if (downloadDatabaseBtn) {
        downloadDatabaseBtn.addEventListener('click', () => {
            window.location.href = '/admin/database/download';
        });
    }

    const uploadDatabaseBtn = document.getElementById('upload-database-btn');
    const databaseUploadInput = document.getElementById('database-upload-input');
    if (uploadDatabaseBtn && databaseUploadInput) {
        uploadDatabaseBtn.addEventListener('click', () => {
            databaseUploadInput.value = '';
            databaseUploadInput.click();
        });

        databaseUploadInput.addEventListener('change', async () => {
            const file = databaseUploadInput.files && databaseUploadInput.files[0];
            if (!file) return;

            if (!confirm('Uploading this database will replace the current athletes, judges, scores, times, and settings. Continue?')) {
                databaseUploadInput.value = '';
                return;
            }

            uploadDatabaseBtn.disabled = true;
            try {
                const res = await fetch('/admin/database/upload', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    },
                    body: file
                });
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || data.message || 'Database upload failed');
                }
                alert('Database uploaded.');
                await loadDashboardData();
                if (adminDatabaseContent && !adminDatabaseContent.classList.contains('hidden')) {
                    await loadDatabaseView();
                }
            } catch(e) {
                alert('Failed to upload database: ' + e.message);
            } finally {
                uploadDatabaseBtn.disabled = false;
                databaseUploadInput.value = '';
            }
        });
    }

    const refreshDatabaseBtn = document.getElementById('refresh-database-btn');
    if (refreshDatabaseBtn) {
        refreshDatabaseBtn.addEventListener('click', loadDatabaseView);
    }

    const tvSelectEl = document.getElementById('tv-scroll-mode-select');
    if (tvSelectEl) {
        tvSelectEl.addEventListener('change', async (e) => {
            const tvScrollMode = e.target.value;
            try {
                await fetchAPI('/admin/config', 'PUT', { tvScrollMode });
            } catch(e) {
                alert('Failed to update TV config: ' + e.message);
            }
        });
    }

    const formulaSelectEl = document.getElementById('scoring-formula-select');
    if (formulaSelectEl) {
        formulaSelectEl.addEventListener('change', async (e) => {
            const scoringFormula = e.target.value;
            try {
                await fetchAPI('/admin/config', 'PUT', { scoringFormula });
            } catch(e) {
                alert('Failed to update scoring formula: ' + e.message);
            }
        });
    }

    const timeDeductionForm = document.getElementById('time-deduction-form');
    if (timeDeductionForm) {
        timeDeductionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const timeJudgeId = document.getElementById('time-judge-select').value;
            const minValue = document.getElementById('time-min-input').value;
            const maxValue = document.getElementById('time-max-input').value;
            const deductionValue = document.getElementById('time-deduction-input').value;
            const timeMinSeconds = Number(minValue);
            const timeMaxSeconds = Number(maxValue);
            const timeDeductionPoints = Number(deductionValue);

            if (minValue.trim() === '' || !Number.isFinite(timeMinSeconds) || timeMinSeconds < 0) {
                return alert('Enter a valid minimum time');
            }
            if (maxValue.trim() === '' || !Number.isFinite(timeMaxSeconds) || timeMaxSeconds < 0) {
                return alert('Enter a valid maximum time');
            }
            if (timeMaxSeconds < timeMinSeconds) {
                return alert('Maximum time must be greater than or equal to minimum time');
            }
            if (deductionValue.trim() === '' || !Number.isFinite(timeDeductionPoints) || timeDeductionPoints < 0) {
                return alert('Enter valid deduction points');
            }

            try {
                await fetchAPI('/admin/config', 'PUT', {
                    timeJudgeId,
                    timeMinSeconds,
                    timeMaxSeconds,
                    timeDeductionPoints
                });
                adminConfig = {
                    ...adminConfig,
                    timeJudgeId,
                    timeMinSeconds: String(timeMinSeconds),
                    timeMaxSeconds: String(timeMaxSeconds),
                    timeDeductionPoints: String(timeDeductionPoints)
                };
                alert('Time settings updated!');
            } catch(e) {
                alert('Failed to update time settings: ' + e.message);
            }
        });
    }

    const currentRoundSelectEl = document.getElementById('current-round-select');
    if (currentRoundSelectEl) {
        currentRoundSelectEl.addEventListener('change', async (e) => {
            const currentRound = e.target.value;
            try {
                await fetchAPI('/admin/config', 'PUT', { currentRound });
                await loadAthletes();
                if (adminDatabaseContent && !adminDatabaseContent.classList.contains('hidden')) {
                    await loadDatabaseView();
                }
            } catch(e) {
                alert('Failed to update current round: ' + e.message);
            }
        });
    }

    const finalistsCountForm = document.getElementById('finalists-count-form');
    if (finalistsCountForm) {
        finalistsCountForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const finalistsCount = parseInt(document.getElementById('finalists-count-input').value, 10);
            if (!Number.isInteger(finalistsCount) || finalistsCount < 1) {
                return alert('Enter a valid finalists count');
            }

            try {
                await fetchAPI('/admin/config', 'PUT', { finalistsCount });
                await loadAthletes();
                if (adminDatabaseContent && !adminDatabaseContent.classList.contains('hidden')) {
                    await loadDatabaseView();
                }
            } catch(e) {
                alert('Failed to update finalists: ' + e.message);
            }
        });
    }

    const appNameForm = document.getElementById('app-name-form');
    if (appNameForm) {
        appNameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const appNameInput = document.getElementById('app-name-input');
            const appName = appNameInput.value.trim();
            if (!appName) return alert('App name cannot be empty');

            try {
                await fetchAPI('/admin/config', 'PUT', { appName });
                applyAppName(appName);
            } catch(e) {
                alert('Failed to update app name: ' + e.message);
            }
        });
    }

    const appIconForm = document.getElementById('app-icon-form');
    if (appIconForm) {
        const appIconInput = document.getElementById('app-icon-input');
        const appIconStatus = document.getElementById('app-icon-status');
        const resetAppIconBtn = document.getElementById('reset-app-icon-btn');

        appIconInput.addEventListener('change', () => {
            const file = appIconInput.files && appIconInput.files[0];
            if (!file) return;

            const previewUrl = URL.createObjectURL(file);
            const preview = document.getElementById('app-icon-preview');
            if (preview) {
                preview.onload = () => URL.revokeObjectURL(previewUrl);
                preview.src = previewUrl;
            }
        });

        appIconForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = appIconInput.files && appIconInput.files[0];
            if (!file) return alert('Choose an icon image first');
            if (file.size > 512 * 1024) return alert('Icon image must be 512 KB or smaller');

            try {
                const imageData = normalizeIconDataURL(await readFileAsDataURL(file), file);
                const result = await fetchAPI('/admin/icon', 'POST', { imageData });
                applyAppIcon(result.appIconUrl);
                appIconInput.value = '';
                showAppIconStatus('Icon updated.', false);
            } catch(e) {
                showAppIconStatus('Failed to update icon: ' + e.message, true);
            }
        });

        resetAppIconBtn.addEventListener('click', async () => {
            try {
                await fetchAPI('/admin/config', 'PUT', { appIconUrl: '/favicon.ico' });
                applyAppIcon('/favicon.ico');
                appIconInput.value = '';
                showAppIconStatus('Icon reset to the default favicon.', false);
            } catch(e) {
                showAppIconStatus('Failed to reset icon: ' + e.message, true);
            }
        });

        function showAppIconStatus(message, isError) {
            appIconStatus.textContent = message;
            appIconStatus.style.color = isError ? 'var(--danger-color)' : 'var(--success-color)';
            appIconStatus.classList.remove('hidden');
        }
    }

    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Could not read selected file'));
            reader.readAsDataURL(file);
        });
    }

    function normalizeIconDataURL(dataUrl, file) {
        if (dataUrl.startsWith('data:;base64,') && file.name.toLowerCase().endsWith('.ico')) {
            return dataUrl.replace('data:;base64,', 'data:image/x-icon;base64,');
        }
        return dataUrl;
    }

    // License Key settings form handling
    const licenseKeyForm = document.getElementById('license-key-form');
    if (licenseKeyForm) {
        licenseKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const licenseKeyInput = document.getElementById('license-key-input');
            const licenseKey = licenseKeyInput.value;
            const statusMessage = document.getElementById('license-status-message');

            try {
                // Call admin/config API to update the licenseKey in DB config
                await fetchAPI('/admin/config', 'PUT', { licenseKey });
                
                // Fetch the new config status
                const cfg = await fetchAPI('/config');
                applyBrandingVisibility(cfg.isLicensed);
                updateLicenseUI(cfg);
            } catch (e) {
                statusMessage.className = 'error';
                statusMessage.textContent = 'Error: ' + e.message;
                statusMessage.classList.remove('hidden');
            }
        });
    }

    function updateLicenseUI(cfg) {
        const statusMessage = document.getElementById('license-status-message');
        const licenseKeyInput = document.getElementById('license-key-input');
        if (!statusMessage) return;

        if (cfg.licenseKey) {
            licenseKeyInput.value = cfg.licenseKey;
        } else {
            licenseKeyInput.value = '';
        }

        if (!cfg.licenseKey) {
            statusMessage.style.background = 'rgba(0, 0, 0, 0.03)';
            statusMessage.style.color = 'var(--text-secondary)';
            statusMessage.style.border = '1px solid rgba(0, 0, 0, 0.05)';
            statusMessage.textContent = '⚪ No active license key loaded. The "Made by Samuel Fronthaler" branding footer is visible.';
            statusMessage.classList.remove('hidden');
        } else if (cfg.isLicensed) {
            statusMessage.style.background = 'rgba(52, 199, 89, 0.1)';
            statusMessage.style.color = '#248a3d';
            statusMessage.style.border = '1px solid rgba(52, 199, 89, 0.15)';
            statusMessage.textContent = `🎉 License Active: Registered to "${cfg.licensee}" (Expires: ${cfg.expiresAt}). Branding footer successfully hidden!`;
            statusMessage.classList.remove('hidden');
        } else {
            statusMessage.style.background = 'rgba(255, 59, 48, 0.08)';
            statusMessage.style.color = '#ff3b30';
            statusMessage.style.border = '1px solid rgba(255, 59, 48, 0.12)';
            statusMessage.textContent = `❌ License Invalid: ${cfg.licenseError || 'Verification failed'}. Branding footer remains visible.`;
            statusMessage.classList.remove('hidden');
        }

        // Lock down all other administrative cards if unlicensed
        const cards = document.querySelectorAll('#admin-view .card');
        cards.forEach(card => {
            const isLicenseCard = card.querySelector('#license-key-form');
            const isDisplaySettingsCard = card.querySelector('#app-name-form');
            if (!isLicenseCard && !isDisplaySettingsCard) {
                if (cfg.isLicensed) {
                    card.classList.remove('unlicensed-disabled');
                } else {
                    card.classList.add('unlicensed-disabled');
                }
            }
        });
    }

    socket.on('state-update', () => {
        if (!adminView.classList.contains('hidden')) {
            loadDashboardData();
            if (adminDatabaseContent && !adminDatabaseContent.classList.contains('hidden')) {
                loadDatabaseView();
            }
        }
    });
}
