/**
 * PTJ Scanner - Position & Trail Judge System (app.js)
 */

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwr_ISMhOrRanQOZwEyX-Ee985ZwxMxCG9JONLc2kr1si68R48QER9Ra_xa48fgzg9T/exec";

// app.js 상단 callBackendApi 수정
async function callBackendApi(action, payload = {}) {
	if (typeof google !== 'undefined' && google.script && google.script.run) {
		return new Promise((resolve, reject) => {
			const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
			if (action === 'login') runner.verifyLogin(payload.id, payload.password);
			else if (action === 'getAll') runner.getAllStockData();
			else if (action === 'add') runner.addNewStock(payload.ticker);
			else if (action === 'update') runner.updateTicker(payload.oldTicker, payload.newTicker);
			else if (action === 'delete') runner.deleteStock(payload.ticker);
		});
	}

	if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("여기에_")) {
		throw new Error("app.js 파일 상단의 GAS_WEB_APP_URL에 구글 스크립트 배포 주소를 확인해 주세요.");
	}

	const response = await fetch(GAS_WEB_APP_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'text/plain;charset=utf-8'
		},
		body: JSON.stringify({ action, ...payload })
	});

	if (!response.ok) {
		throw new Error(`HTTP 통신 오류 (${response.status})`);
	}

	return await response.json();
}

// === [신규 추가] 로그인 / 인증 제어 로직 ===
const SESSION_KEY = "PTJ_SESSION_AUTH";

function checkAuthSession() {
	const sessionStr = localStorage.getItem(SESSION_KEY);
	if (!sessionStr) return false;

	try {
		const session = JSON.parse(sessionStr);
		const now = new Date().getTime();
		if (session.token && session.expiresAt && now < session.expiresAt) {
			return true;
		}
	} catch (e) {
		localStorage.removeItem(SESSION_KEY);
	}
	return false;
}

function showLoginView() {
	const loginEl = document.getElementById('loginContainer');
	const appEl = document.getElementById('appContainer');
	if (loginEl) loginEl.style.display = 'flex';
	if (appEl) appEl.style.display = 'none';
}

function showMainAppView() {
	const loginEl = document.getElementById('loginContainer');
	const appEl = document.getElementById('appContainer');
	if (loginEl) loginEl.style.display = 'none';
	if (appEl) appEl.style.display = 'block';
	fetchStockData();
}

async function handleLoginSubmit(e) {
	e.preventDefault();
	const idEl = document.getElementById('loginId');
	const pwEl = document.getElementById('loginPw');
	const submitBtn = document.getElementById('btnLoginSubmit');

	const id = idEl.value.trim();
	const password = pwEl.value.trim();

	if (!id || !password) {
		AppAlert.warning('알림', '아이디와 비밀번호를 모두 입력해 주세요.');
		return;
	}

	submitBtn.disabled = true;
	submitBtn.innerText = '인증 중...';

	try {
		const res = await callBackendApi('login', { id, password });
		if (res && res.success) {
			localStorage.setItem(SESSION_KEY, JSON.stringify({
				token: res.token,
				expiresAt: res.expiresAt
			}));
			idEl.value = '';
			pwEl.value = '';
			showMainAppView();
		} else {
			AppAlert.error('로그인 실패', res ? res.error : '계정 정보가 올바르지 않습니다.');
		}
	} catch (err) {
		AppAlert.error('오류 발생', '통신 중 오류가 발생했습니다: ' + err.message);
	} finally {
		submitBtn.disabled = false;
		submitBtn.innerText = '로그인';
	}
}

function handleLogout() {
	AppAlert.confirm('로그아웃', '정말로 로그아웃하시겠습니까?', () => {
		localStorage.removeItem(SESSION_KEY);
		showLoginView();
	});
}

const AppAlert = {
	backdrop: null, titleEl: null, textEl: null, iconEl: null, spinnerEl: null, inputEl: null, confirmBtn: null, cancelBtn: null, allowOutsideClick: true,
	init() {
		this.backdrop = document.getElementById('swalBackdrop');
		this.titleEl = document.getElementById('swalTitle');
		this.textEl = document.getElementById('swalText');
		this.iconEl = document.getElementById('swalIcon');
		this.spinnerEl = document.getElementById('swalSpinner');
		this.inputEl = document.getElementById('swalInput');
		this.confirmBtn = document.getElementById('swalConfirmBtn');
		this.cancelBtn = document.getElementById('swalCancelBtn');
		this.backdrop.addEventListener('click', (e) => {
			if (e.target === this.backdrop && this.allowOutsideClick) this.close();
		});
	},
	close() {
		if (!this.backdrop) this.init();
		this.backdrop.style.display = 'none';
	},
	info(title, htmlContent) {
		this.show({ icon: 'info', title, text: htmlContent, showCancel: false, confirmText: '닫기', allowOutsideClick: true });
	},
	warning(title, text) {
		this.show({ icon: 'warning', title, text, showCancel: false, confirmText: '확인', allowOutsideClick: true });
	},
	error(title, text) {
		this.show({ icon: 'error', title, text, showCancel: false, confirmText: '확인', allowOutsideClick: true });
	},
	success(title, text, timer = 1400) {
		this.show({ icon: 'success', title, text, showCancel: false, showConfirm: false, allowOutsideClick: true });
		setTimeout(() => this.close(), timer);
	},
	loading(title, text) {
		this.show({ showSpinner: true, title, text, showCancel: false, showConfirm: false, allowOutsideClick: false });
	},
	confirm(title, text, onConfirm, isDanger = false) {
		this.show({
			icon: isDanger ? 'warning' : 'info',
			title, text,
			showCancel: true,
			confirmText: isDanger ? '삭제하기' : '확인',
			isDanger: isDanger,
			allowOutsideClick: true,
			onConfirm
		});
	},
	input(title, text, initialVal, onConfirm) {
		this.show({
			icon: 'info',
			title, text,
			showInput: true,
			inputValue: initialVal,
			showCancel: true,
			confirmText: '시트에 등록',
			allowOutsideClick: true,
			onConfirm: (val) => {
				if (!val || !val.trim()) {
					AppAlert.warning('알림', '티커를 입력해 주세요.');
					return;
				}
				onConfirm(val.trim().toUpperCase());
			}
		});
	},
	show(opt) {
		if (!this.backdrop) this.init();
		this.allowOutsideClick = opt.allowOutsideClick !== false;
		this.spinnerEl.style.display = opt.showSpinner ? 'block' : 'none';
		if (opt.icon) {
			this.iconEl.style.display = 'flex';
			this.iconEl.className = 'swal-icon swal-icon-' + opt.icon;
			this.iconEl.innerHTML = opt.icon === 'warning' ? '!' : opt.icon === 'error' ? '✕' : opt.icon === 'success' ? '✓' : 'i';
		} else {
			this.iconEl.style.display = 'none';
		}
		this.titleEl.innerText = opt.title || '';
		this.textEl.innerHTML = opt.text || '';
		if (opt.showInput) {
			this.inputEl.style.display = 'block';
			this.inputEl.value = opt.inputValue || '';
			setTimeout(() => this.inputEl.focus(), 60);
		} else {
			this.inputEl.style.display = 'none';
		}
		this.confirmBtn.style.display = opt.showConfirm === false ? 'none' : 'block';
		this.confirmBtn.innerText = opt.confirmText || '확인';
		this.confirmBtn.className = 'swal-btn ' + (opt.isDanger ? 'swal-btn-danger' : 'swal-btn-confirm');
		this.cancelBtn.style.display = opt.showCancel ? 'block' : 'none';
		this.cancelBtn.onclick = () => this.close();
		this.confirmBtn.onclick = () => {
			const val = this.inputEl.value;
			this.close();
			if (opt.onConfirm) opt.onConfirm(val);
		};
		this.backdrop.style.display = 'flex';
	}
};

let stockDataStore = {};
let marketDataStore = null;
let isDataLoaded = false;
let currentSelectedTicker = null;
let isAnimating = false;
let currentViewMode = 'list';

function getBadgeClass(decisionStr) {
	const str = String(decisionStr || '');
	if (str.includes('신고가')) return 'badge-ath';
	if (str.includes('박스하단')) return 'badge-box-buy';
	if (str.includes('1차익절')) return 'badge-exit-1';
	if (str.includes('2차익절')) return 'badge-exit-2';
	if (str.includes('3차익절')) return 'badge-exit-3';
	return 'badge-box-wait';
}

function parseCleanNum(valStr) {
	if (!valStr || valStr === '-' || valStr === '#N/A') return NaN;
	return parseFloat(String(valStr).replace(/[^0-9.-]+/g, ''));
}

// 안전 텍스트 대입 헬퍼 (모바일 캐시 불일치 시 null 에러 방어)
function safeSetText(id, text) {
	const el = document.getElementById(id);
	if (el) el.innerText = text;
}

function showTip(type) {
	const data = currentSelectedTicker ? stockDataStore[currentSelectedTicker] : null;

	let marketBoxHtml = '';
	if (marketDataStore && marketDataStore.sp500 && marketDataStore.nasdaq) {
		const sp = marketDataStore.sp500;
		const nq = marketDataStore.nasdaq;
		marketBoxHtml = `
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <div style="flex:1; background:#f9fafb; padding:8px; border-radius:8px; border:1px solid #edf0f2; text-align:center;">
        <div style="font-size:11px; font-weight:700; color:#4e5968;">S&P 500</div>
        <div style="font-size:13px; font-weight:800; color:#191f28; margin:4px 0;">${sp.price || '-'}</div>
        <span style="font-size:10px; font-weight:700; padding:2px 5px; border-radius:4px; color:${sp.pass ? '#137333' : '#c5221f'}; background:${sp.pass ? '#e6f4ea' : '#fce8e6'}">${sp.diffText || '-'}</span>
      </div>
      <div style="flex:1; background:#f9fafb; padding:8px; border-radius:8px; border:1px solid #edf0f2; text-align:center;">
        <div style="font-size:11px; font-weight:700; color:#4e5968;">나스닥</div>
        <div style="font-size:13px; font-weight:800; color:#191f28; margin:4px 0;">${nq.price || '-'}</div>
        <span style="font-size:10px; font-weight:700; padding:2px 5px; border-radius:4px; color:${nq.pass ? '#137333' : '#c5221f'}; background:${nq.pass ? '#e6f4ea' : '#fce8e6'}">${nq.diffText || '-'}</span>
      </div>
    </div>`;
	}

	const isKR = data && data.isKR;
	const kstTime = data ? data.tradeTime : '-';
	const usTime = data ? data.tradeTimeUS : '-';

	let tradeTimeHtml = '';
	if (isKR) {
		tradeTimeHtml = `
    <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px;font-size:12.5px;">
      <div style="display:flex;justify-content:space-between;">
        <span>🇰🇷 <b>한국 정규장</b> (09:00~15:30)</span>
        <span style="font-weight:700;color:#1e293b;">${kstTime}</span>
      </div>
    </div>`;
	} else {
		tradeTimeHtml = `
    <div style="background:#f8fafc;padding:10px 12px;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:12px;font-size:12.5px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span>🇰🇷 <b>한국 (KST)</b></span>
        <span style="font-weight:700;color:#1e293b;">${kstTime}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span>🇺🇸 <b>미국 (현지)</b></span>
        <span style="font-weight:700;color:#1e293b;">${usTime}</span>
      </div>
    </div>`;
	}

	const tips = {
		market: {
			title: '시장 추세 (마크로 필터)',
			text: marketBoxHtml + '<b>S&P 500과 나스닥 종합지수</b>의 200일선 상회 여부를 보여줍니다.<br><br>• <b>원칙</b>: 전체 시장이 하락세(▼)일 때는 개별 종목 매매 확률이 떨어지므로 비중을 조절합니다.'
		},
		priceRange: {
			title: '시세 게이지 바',
			text: '<b>현재 주가가 변동 밴드 안에서 어느 위치에 있는지를 보여줍니다.</b><br><br>' +
				'• <b>1일 레인지</b>: 오늘 장중 최저가와 최고가 사이의 현재가 위치<br>' +
				'• <b>1년 레인지</b>: 최근 52주 최저가와 최고가 사이의 현재가 위치<br>' +
				'• <b>초록색 핀</b>이 오른쪽 끝에 가까울수록 신고가 돌파 임박/신고가 랠리 영역입니다.'
		},
		decision: {
			title: 'PTJ 전략 판정 기준 (Position & Trail)',
			text: '<b>[3단계 사이클 핵심 판정 원칙]</b><br><br>' +
				'• <b>🔵 박스하단(매수관심)</b>: 최근 30일 박스 하단 지지선 근처에 위치한 저가 모아가는 자리<br>' +
				'• <b>🟢 신고가 랠리(홀딩)</b>: 52주 신고가를 돌파해 위로 매물벽이 없는 초강세 구간. 절대 미리 팔지 말고 홀딩!<br>' +
				'• <b>🟡 1차익절 (30%)</b>: 5일선 하향 이탈 시 보유 물량의 30% 차익 실현<br>' +
				'• <b>🟠 2차익절 (30%)</b>: 10일선 하향 이탈 시 추가 30% 차익 실현<br>' +
				'• <b>🔴 3차익절 (전량)</b>: 20일선 하향 이탈 시 잔여 물량 정리 및 추세 종료'
		},
		ath: {
			title: '52주 최고가 (52-Week High) 및 돌파',
			text: '<b>최근 1년(52주) 중 가장 높았던 주가</b>입니다.<br><br>• 52주 신고가를 뚫어낸 자리는 물려있는 매물벽이 없어 단기간에 강한 랠리가 펼쳐집니다. 이 구간에서는 5일선이 깨지기 전까지 수익을 끝까지 추적합니다.'
		},
		box: {
			title: '30일 박스권 범위 (Donchian Channel)',
			text: '<b>최근 30거래일 동안의 최고가(상단)와 최저가(하단)</b>입니다.<br><br>• 주가가 박스 하단 근처(+3% 이내)에 머물며 지지받을 때가 남들이 관심 없을 때 가장 안전하게 포지션을 선점하는 진입 자리입니다.'
		},
		maLevels: {
			title: '5·10·20일 이동평균선 (위치 상태)',
			text: '<b>[단기 추세선 대비 주가 위치]</b><br><br>' +
				'• <b>위 ▲ (연초록)</b>: 현재 주가가 이평선 위에 안착하여 상승 추세 유지 중<br>' +
				'• <b>아래 ▼ (연빨강)</b>: 현재 주가가 이평선 아래로 떨어져 단기 하향 이탈 중<br><br>' +
				'5MA ➔ 10MA ➔ 20MA가 차례로 깨질 때마다 30%씩 분할 매도하여 익절을 확정합니다.'
		},
		exitRule: {
			title: '대응 가이드 (분할 청산 원칙)',
			text: '<b>신고가 돌파 후 하락 전환 시 기계적으로 대응합니다.</b><br><br>' +
				'감정에 흔들리지 않고 현재 주가가 5일선 ➔ 10일선 ➔ 20일선을 하향 이탈할 때마다 30%씩 분할 매도하여 수익을 확정합니다.'
		},
		tradetime: {
			title: '최종 체결 시간',
			text: tradeTimeHtml + `• <b>장중</b>에는 실시간(지연) 체결 시각, <b>장 마감 후</b>에는 최종 마감 시각이 표시됩니다.<br>${isKR ? '' : '• 미국 주식은 서머타임이 자동 반영되어 KST로 변환됩니다.'}`
		},
		corpName: {
			title: '기업 상세명',
			text: data ? `<b>[${data.ticker}]</b><br>${data.name}` : '기업 정보 없음'
		}
	};

	if (tips[type]) {
		AppAlert.info(tips[type].title, tips[type].text);
	}
}

function isPCLayout() {
	return window.innerWidth >= 768;
}

function switchViewMode(mode) {
	currentViewMode = mode;
	const btnList = document.getElementById('btnViewList');
	const btnCard = document.getElementById('btnViewCard');
	const chipWrapper = document.getElementById('chipWrapper');
	const cardViewArea = document.getElementById('cardViewArea');
	const listViewArea = document.getElementById('listViewArea');

	const hasStocks = Object.keys(stockDataStore || {}).length > 0;

	if (isPCLayout()) {
		if (chipWrapper) chipWrapper.style.display = 'none';
		if (listViewArea) listViewArea.style.display = hasStocks ? 'block' : 'none';
		if (cardViewArea) cardViewArea.style.display = hasStocks ? 'block' : 'none';
		renderListView();
		if (currentSelectedTicker) renderCard(currentSelectedTicker);
		return;
	}

	if (mode === 'card') {
		if (btnCard) btnCard.classList.add('active');
		if (btnList) btnList.classList.remove('active');
		if (chipWrapper) chipWrapper.style.display = 'block';
		if (listViewArea) listViewArea.style.display = 'none';
		if (cardViewArea) cardViewArea.style.display = hasStocks ? 'block' : 'none';
		if (currentSelectedTicker) {
			selectTicker(currentSelectedTicker, null, true);
		}
	} else {
		if (btnList) btnList.classList.add('active');
		if (btnCard) btnCard.classList.remove('active');
		if (chipWrapper) chipWrapper.style.display = 'none';
		if (cardViewArea) cardViewArea.style.display = 'none';
		if (listViewArea) listViewArea.style.display = hasStocks ? 'block' : 'none';
		renderListView();
	}
}

function renderListView() {
	const container = document.getElementById('stockListContainer');
	if (!container) return;
	container.innerHTML = '';

	const tickers = Object.keys(stockDataStore || {}).sort((a, b) =>
		a.trim().localeCompare(b.trim(), 'en', { sensitivity: 'base' })
	);

	tickers.forEach(t => {
		const item = stockDataStore[t];
		if (!item) return;

		const cardEl = document.createElement('div');
		cardEl.className = 'list-card-item' + (t === currentSelectedTicker ? ' selected' : '');

		const badgeClass = getBadgeClass(item.decision);
		const athDiff = item.drawdownATH && item.drawdownATH !== '-' ? `52W ${item.drawdownATH}` : '52W -';

		cardEl.innerHTML = `
      <div class="list-card-row-top">
        <div class="list-item-ticker-wrap">
          <span class="list-ticker">${item.ticker || '-'}</span>
          <span class="list-price">${item.currentPrice || '-'}</span>
        </div>
        <span class="list-badge ${badgeClass}">${item.decision || '-'}</span>
      </div>
      <div class="list-card-row-bottom">
        <span class="list-corp-name">${item.name || '-'}</span>
        <span class="list-ath-diff">${athDiff}</span>
        <span class="base-tag">박스폭 ${item.boxRange || '-'}</span>
      </div>
    `;

		cardEl.onclick = () => {
			selectTicker(t, null, true);
			if (!isPCLayout()) {
				switchViewMode('card');
			}
		};
		container.appendChild(cardEl);
	});
}

window.addEventListener('resize', () => {
	switchViewMode(currentViewMode);
});

// window.addEventListener('DOMContentLoaded', ...) 초기화 진입점 수정
window.addEventListener('DOMContentLoaded', () => {
	AppAlert.init();

	// 인증 상태 검사 후 분기 실행
	if (checkAuthSession()) {
		showMainAppView();
	} else {
		showLoginView();
	}

	const container = document.getElementById('chipContainer');
	const wrapper = document.getElementById('chipWrapper');
	if (container && wrapper) {
		container.addEventListener('scroll', () => {
			const isEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
			wrapper.classList.toggle('at-end', isEnd);
		});
	}

	const btnAdd = document.getElementById('btnAddChip');
	if (btnAdd) btnAdd.onclick = () => openAddStockDialog('');
	const btnDel = document.getElementById('btnDeleteStock');
	if (btnDel) btnDel.onclick = handleDeleteStockDialog;
	const btnEdit = document.getElementById('btnEditStock');
	if (btnEdit) btnEdit.onclick = handleEditStockDialog;

	const swalIn = document.getElementById('swalInput');
	if (swalIn) {
		swalIn.onkeydown = (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				document.getElementById('swalConfirmBtn').click();
			}
		};
	}

	initSwipeGesture();
});

function initSwipeGesture() {
	const card = document.getElementById('stockCard');
	if (!card) return;
	let startX = 0, startY = 0, endX = 0, endY = 0;

	card.addEventListener('touchstart', (e) => {
		if (e.touches && e.touches.length > 0) {
			startX = e.touches[0].clientX;
			startY = e.touches[0].clientY;
			endX = startX;
			endY = startY;
		}
	}, { passive: true });

	card.addEventListener('touchmove', (e) => {
		if (e.touches && e.touches.length > 0) {
			endX = e.touches[0].clientX;
			endY = e.touches[0].clientY;
		}
	}, { passive: true });

	card.addEventListener('touchend', () => {
		if (isAnimating || (!isPCLayout() && currentViewMode !== 'card')) return;
		handleSwipe();
	}, { passive: true });

	function handleSwipe() {
		const diffX = endX - startX;
		const diffY = endY - startY;

		if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
			const tickers = Object.keys(stockDataStore || {}).sort((a, b) =>
				a.trim().localeCompare(b.trim(), 'en', { sensitivity: 'base' })
			);
			if (tickers.length <= 1) return;

			const currentIndex = tickers.indexOf(currentSelectedTicker);
			if (currentIndex === -1) return;

			if (diffX < 0) {
				const nextIndex = (currentIndex + 1) % tickers.length;
				transitionCard(tickers[nextIndex], 'left');
			} else {
				const prevIndex = (currentIndex - 1 + tickers.length) % tickers.length;
				transitionCard(tickers[prevIndex], 'right');
			}
		}
	}
}

function transitionCard(targetTicker, direction) {
	if (isAnimating) return;
	isAnimating = true;

	const card = document.getElementById('stockCard');
	if (!card) return;
	const outClass = direction === 'left' ? 'slide-out-left' : 'slide-out-right';
	const inReadyClass = direction === 'left' ? 'slide-in-right-ready' : 'slide-in-left-ready';

	card.classList.add(outClass);

	setTimeout(() => {
		card.classList.remove(outClass);
		card.classList.add(inReadyClass);
		selectTicker(targetTicker, null, true);
		void card.offsetWidth;

		requestAnimationFrame(() => {
			card.classList.remove(inReadyClass);
			setTimeout(() => {
				isAnimating = false;
			}, 190);
		});
	}, 160);
}

function applyServerResponse(res, preferredTicker = null, keepViewMode = false) {
	stockDataStore = res.data || {};
	if (res.market) {
		marketDataStore = res.market;
		safeSetText('valSP500', res.market.sp500.price || '-');
		const spPill = document.getElementById('pillSP500');
		if (spPill) {
			spPill.innerText = res.market.sp500.diffText || '-';
			spPill.className = 'market-pill ' + (res.market.sp500.pass ? 'market-up' : 'market-down');
		}

		safeSetText('valNASDAQ', res.market.nasdaq.price || '-');
		const nqPill = document.getElementById('pillNASDAQ');
		if (nqPill) {
			nqPill.innerText = res.market.nasdaq.diffText || '-';
			nqPill.className = 'market-pill ' + (res.market.nasdaq.pass ? 'market-up' : 'market-down');
		}

		updateMacroHeaderBadge(res.market.sp500.pass, res.market.nasdaq.pass);
	}

	const statusEl = document.getElementById('statusMsg');
	if (statusEl) statusEl.style.display = 'none';
	renderChips(preferredTicker);
	switchViewMode(keepViewMode ? currentViewMode : 'list');
}

async function fetchStockData(preferredTicker = null, isManualRefresh = false) {
	const refreshBtn = document.getElementById('btnRefresh');
	if (refreshBtn) refreshBtn.classList.add('spinning');

	const statusEl = document.getElementById('statusMsg');
	if (!isManualRefresh && statusEl) {
		statusEl.style.display = 'block';
		statusEl.innerText = "데이터 동기화 중...";
	}

	try {
		const res = await callBackendApi('getAll');
		isDataLoaded = true;
		if (!res || !res.success) {
			AppAlert.error('로딩 실패', res ? res.error : "데이터 로딩 실패");
			if (statusEl) statusEl.innerText = "데이터를 불러오지 못했습니다.";
			return;
		}
		applyServerResponse(res, preferredTicker, isManualRefresh);
	} catch (err) {
		isDataLoaded = true;
		if (statusEl) {
			statusEl.style.display = 'block';
			statusEl.innerText = "통신 오류: " + err.message;
		}
	} finally {
		if (refreshBtn) refreshBtn.classList.remove('spinning');
	}
}

function updateMacroHeaderBadge(spPass, nqPass) {
	const badgeEl = document.getElementById('macroStatusBadge');
	const dotEl = document.getElementById('macroStatusDot');
	const textEl = document.getElementById('macroStatusText');
	if (!badgeEl || !dotEl || !textEl) return;

	if (spPass && nqPass) {
		badgeEl.className = 'macro-indicator-badge macro-bull';
		dotEl.className = 'macro-dot dot-bull';
		textEl.innerText = 'BULL MARKET';
	} else if (!spPass && !nqPass) {
		badgeEl.className = 'macro-indicator-badge macro-bear';
		dotEl.className = 'macro-dot dot-bear';
		textEl.innerText = 'BEAR MARKET';
	} else {
		badgeEl.className = 'macro-indicator-badge macro-caution';
		dotEl.className = 'macro-dot dot-caution';
		textEl.innerText = 'CAUTION';
	}
}

function renderChips(preferredTicker = null) {
	const chipList = document.getElementById('chipList');
	if (!chipList) return;
	chipList.innerHTML = '';
	const tickers = Object.keys(stockDataStore || {}).sort((a, b) =>
		a.trim().localeCompare(b.trim(), 'en', { sensitivity: 'base' })
	);

	const cardArea = document.getElementById('cardViewArea');
	const listArea = document.getElementById('listViewArea');
	const statusEl = document.getElementById('statusMsg');

	if (tickers.length === 0) {
		currentSelectedTicker = null;
		if (statusEl) {
			statusEl.style.display = 'block';
			statusEl.innerText = "등록된 종목이 없습니다. 새 종목을 추가해 보세요.";
		}
		if (cardArea) cardArea.style.display = 'none';
		if (listArea) listArea.style.display = 'none';
		return;
	}

	let targetTicker = preferredTicker && stockDataStore[preferredTicker] ? preferredTicker : tickers[0];

	tickers.forEach(t => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'chip' + (t === targetTicker ? ' active' : '');
		btn.innerText = t;
		btn.onclick = () => {
			if (t !== currentSelectedTicker) {
				const currentIndex = tickers.indexOf(currentSelectedTicker);
				const nextIndex = tickers.indexOf(t);
				const dir = nextIndex > currentIndex ? 'left' : 'right';
				transitionCard(t, dir);
			}
		};
		chipList.appendChild(btn);
	});

	const activeBtn = chipList.querySelector('.chip.active');
	selectTicker(targetTicker, activeBtn, true);
}

function selectTicker(ticker, targetElement = null, shouldRender = true) {
	currentSelectedTicker = ticker;
	const chips = document.querySelectorAll('.chip');
	let targetChip = targetElement;

	chips.forEach(c => {
		const isActive = (c.innerText === ticker);
		c.classList.toggle('active', isActive);
		if (isActive) targetChip = c;
	});

	if (targetChip) {
		targetChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
	}

	document.querySelectorAll('.list-card-item').forEach(item => {
		const tickerSpan = item.querySelector('.list-ticker');
		if (tickerSpan) {
			item.classList.toggle('selected', tickerSpan.innerText.trim() === ticker);
		}
	});

	if (shouldRender) {
		renderCard(ticker);
	}
}

function renderCard(ticker) {
	if (!ticker || !stockDataStore || !stockDataStore[ticker]) return;
	const data = stockDataStore[ticker];
	const isKR = data.isKR === true;

	safeSetText('resTicker', data.ticker || '-');
	const finLink = document.getElementById('linkFinviz');

	if (finLink) {
		if (isKR) {
			finLink.href = 'https://m.stock.naver.com/domestic/stock/' + data.ticker;
			finLink.innerText = 'N';
			finLink.title = '네이버페이 증권 차트 보기';
			finLink.className = 'btn-finviz-chart naver-btn';
		} else {
			finLink.href = 'https://finviz.com/quote.ashx?t=' + encodeURIComponent(data.ticker);
			finLink.innerText = '📈';
			finLink.title = 'Finviz 차트 보기';
			finLink.className = 'btn-finviz-chart';
		}
	}

	safeSetText('resCorpName', (data.name && data.name !== data.ticker) ? data.name : '');
	safeSetText('resPrice', data.currentPrice || '-');

	// 상태 배지 판정
	const badge = document.getElementById('decisionBadge');
	if (badge) {
		badge.innerText = data.decision || '-';
		badge.className = 'badge ' + getBadgeClass(data.decision);
	}

	// 52주 최고가 대비 이격도
	const numP = parseCleanNum(data.currentPrice);
	const numATH = parseCleanNum(data.high52);
	const pill = document.getElementById('resATHPill');

	if (pill) {
		let athDiffVal = 0;
		let isNearATH = false;
		if (!isNaN(numP) && !isNaN(numATH) && numATH > 0) {
			athDiffVal = ((numP - numATH) / numATH * 100).toFixed(1);
			isNearATH = athDiffVal >= -2.0;
		}
		pill.innerText = isNearATH ? '★ 52W 신고가 돌파' : `52W High 대비 ${athDiffVal}%`;
		pill.className = 'trend-pill ' + (isNearATH ? 'trend-up' : 'trend-down');
	}

	// 시세 레인지 게이지 바
	const numDayLow = parseCleanNum(data.dayLow);
	const numDayHigh = parseCleanNum(data.dayHigh);
	const numYearLow = parseCleanNum(data.low52);

	safeSetText('resDayLow', data.dayLow || '-');
	safeSetText('resDayHigh', data.dayHigh || '-');
	safeSetText('resYearLow', data.low52 || '-');
	safeSetText('resYearHigh', data.high52 || '-');

	// 1일 게이지 핀 위치 (%)
	const dayPin = document.getElementById('dayRangePin');
	if (dayPin) {
		let dayPct = 50;
		if (!isNaN(numP) && !isNaN(numDayLow) && !isNaN(numDayHigh) && numDayHigh > numDayLow) {
			dayPct = Math.max(0, Math.min(100, ((numP - numDayLow) / (numDayHigh - numDayLow)) * 100));
		}
		dayPin.style.left = `${dayPct}%`;
	}

	// 1년 게이지 핀 위치 (%)
	const yearPin = document.getElementById('yearRangePin');
	if (yearPin) {
		let yearPct = 50;
		if (!isNaN(numP) && !isNaN(numYearLow) && !isNaN(numATH) && numATH > numYearLow) {
			yearPct = Math.max(0, Math.min(100, ((numP - numYearLow) / (numATH - numYearLow)) * 100));
		}
		yearPin.style.left = `${yearPct}%`;
	}

	// 통계 1: 52주 최고가
	safeSetText('resHigh52', data.high52 || '-');
	const ddEl = document.getElementById('resDrawdownATH');
	if (ddEl) {
		if (data.drawdownATH && data.drawdownATH !== '-') {
			ddEl.innerText = `(${data.drawdownATH})`;
			ddEl.style.display = 'inline';
		} else {
			ddEl.style.display = 'none';
		}
	}

	// 통계 2: 30일 박스권 범위
	safeSetText('resBoxLow', data.boxLow || '-');
	safeSetText('resBoxHigh', data.boxHigh || '-');
	safeSetText('resBoxRangeBadge', `폭 ${data.boxRange || '-'}`);

	// 통계 3: 5·10·20MA 이평선 (위 ▲ / 아래 ▼ 문구 적용)
	const numMA5 = parseCleanNum(data.ma5);
	const numMA10 = parseCleanNum(data.ma10);
	const numMA20 = parseCleanNum(data.ma20);

	safeSetText('valMA5', data.ma5 || '-');
	safeSetText('valMA10', data.ma10 || '-');
	safeSetText('valMA20', data.ma20 || '-');

	const applyStripState = (rowId, badgeId, maVal) => {
		const rowEl = document.getElementById(rowId);
		const badgeEl = document.getElementById(badgeId);
		if (!rowEl || !badgeEl) return;
		if (isNaN(numP) || isNaN(maVal)) {
			rowEl.className = 'ma-strip-row';
			badgeEl.innerText = '-';
			return;
		}
		const isPass = numP >= maVal;
		rowEl.className = 'ma-strip-row ' + (isPass ? 'pass' : 'broken');
		badgeEl.innerText = isPass ? '위 ▲' : '아래 ▼';
	};

	applyStripState('stripMA5', 'badgeMA5', numMA5);
	applyStripState('stripMA10', 'badgeMA10', numMA10);
	applyStripState('stripMA20', 'badgeMA20', numMA20);

	// 통계 4: 대응 가이드 (2단 분리)
	const exitMainEl = document.getElementById('resExitMain');
	const exitSubEl = document.getElementById('resExitSub');

	if (exitMainEl && exitSubEl) {
		if (!isNaN(numP) && !isNaN(numMA5) && numP >= numMA5) {
			exitMainEl.innerText = `5MA (${data.ma5 || '-'})`;
			exitMainEl.className = 'exit-line-main blue';
			exitSubEl.innerText = '하회 시 30% 1차 분할 매도';
		} else if (!isNaN(numP) && !isNaN(numMA10) && numP >= numMA10) {
			exitMainEl.innerText = `10MA (${data.ma10 || '-'})`;
			exitMainEl.className = 'exit-line-main red';
			exitSubEl.innerText = '하회 시 30% 2차 분할 매도';
		} else if (!isNaN(numP) && !isNaN(numMA20) && numP >= numMA20) {
			exitMainEl.innerText = `20MA (${data.ma20 || '-'})`;
			exitMainEl.className = 'exit-line-main red';
			exitSubEl.innerText = '하회 시 전량 정리 (추세 종료)';
		} else {
			exitMainEl.innerText = '전량 정리 완료';
			exitMainEl.className = 'exit-line-main muted';
			exitSubEl.innerText = '관망 / 다음 박스 하단 대기';
		}
	}

	safeSetText('resTradeTime', data.tradeTime || "-");

	const cardArea = document.getElementById('cardViewArea');
	if (cardArea && (isPCLayout() || currentViewMode === 'card')) {
		cardArea.style.display = 'block';
	}
}

function openAddStockDialog(initialVal = '') {
	const msg = initialVal ? `<b>[${initialVal}]</b> 종목을 시트에 새로 등록하시겠습니까?` : '추가할 주식 티커(종목코드)를 입력하세요.<br><span style="font-size:12px;color:#888;">* 국장은 6자리 숫자 (예: 005930)</span>';
	AppAlert.input('새 종목 등록', msg, initialVal, (ticker) => {
		addNewTickerServer(ticker);
	});
}

function handleEditStockDialog() {
	if (!currentSelectedTicker) return;
	AppAlert.input('종목 수정', `현재 <b>[${currentSelectedTicker}]</b> 종목을 대체할 새로운 티커를 입력하세요.`, currentSelectedTicker, async (newTicker) => {
		if (newTicker === currentSelectedTicker) return;
		AppAlert.loading('종목 변경 중', `<b>${currentSelectedTicker}</b> ➔ <b>${newTicker}</b> 교체 중...`);

		try {
			const res = await callBackendApi('update', { oldTicker: currentSelectedTicker, newTicker });
			if (!res || !res.success) {
				AppAlert.error('수정 실패', res ? res.error : "수정 처리에 실패했습니다.");
				return;
			}
			applyServerResponse(res, newTicker, true);
			AppAlert.success('수정 완료', `[${newTicker}] 교체가 완료되었습니다.`);
		} catch (err) {
			AppAlert.error('통신 오류', String(err.message || err));
		}
	});
}

function handleDeleteStockDialog() {
	if (!currentSelectedTicker) return;
	AppAlert.confirm('종목 삭제', `정말로 <b>[${currentSelectedTicker}]</b> 종목을 시트에서 완전히 삭제하시겠습니까?`, () => {
		deleteStockServer(currentSelectedTicker);
	}, true);
}

async function addNewTickerServer(ticker) {
	AppAlert.loading('데이터 계산 중', `<b>${ticker}</b> 박스권 및 5·10·20 이동평균선을 계산하고 있습니다...<br><span style="font-size:12px;color:#888;">(구글 파이낸스 동기화에 2~4초 소요)</span>`);
	try {
		const res = await callBackendApi('add', { ticker });
		if (!res || !res.success) {
			AppAlert.error('등록 실패', res ? res.error : "등록에 실패했습니다.");
			return;
		}
		applyServerResponse(res, ticker, true);
		AppAlert.success('등록 완료', `[${ticker}] 등록이 완료되었습니다.`);
	} catch (err) {
		AppAlert.error('통신 오류', String(err.message || err));
	}
}

async function deleteStockServer(ticker) {
	AppAlert.loading('종목 삭제 중', `[${ticker}] 시트 행을 정리하고 있습니다...`);
	try {
		const res = await callBackendApi('delete', { ticker });
		if (!res || !res.success) {
			AppAlert.error('삭제 실패', res ? res.error : "삭제 처리에 실패했습니다.");
			return;
		}
		applyServerResponse(res, null, true);
		AppAlert.success('삭제 완료', `[${ticker}] 삭제되었습니다.`);
	} catch (err) {
		AppAlert.error('통신 오류', String(err.message || err));
	}
}