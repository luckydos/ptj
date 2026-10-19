/**
 * PTJ Scanner - Position & Trail Judge System (app.js)
 */

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwr_ISMhOrRanQOZwEyX-Ee985ZwxMxCG9JONLc2kr1si68R48QER9Ra_xa48fgzg9T/exec";

async function callBackendApi(action, payload = {}) {
	if (typeof google !== 'undefined' && google.script && google.script.run) {
		return new Promise((resolve, reject) => {
			const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
			if (action === 'getAll') runner.getAllStockData();
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
			title: '52주 신고가 (ATH) 및 돌파',
			text: '<b>최근 1년(52주) 중 가장 높았던 주가</b>입니다.<br><br>• 52주 신고가를 뚫어낸 자리는 물려있는 매물벽이 없어 단기간에 강한 랠리가 펼쳐집니다. 이 구간에서는 5일선이 깨지기 전까지 수익을 끝까지 추적합니다.'
		},
		box: {
			title: '30일 박스권 범위 (Donchian Channel)',
			text: '<b>최근 30거래일 동안의 최고가(상단)와 최저가(하단)</b>입니다.<br><br>• 주가가 박스 하단 근처(+3% 이내)에 머물며 지지받을 때가 남들이 관심 없을 때 가장 안전하게 포지션을 선점하는 진입 자리입니다.'
		},
		maLevels: {
			title: '5·10·20일 이동평균선',
			text: '<b>[단기 추세 추종 라인]</b><br><br>' +
				'• <b>5MA</b>: 초단기 가속선 (이탈 시 탄력 둔화)<br>' +
				'• <b>10MA</b>: 단기 생명선 (이탈 시 눌림목 깊어짐)<br>' +
				'• <b>20MA</b>: 스윙 추세선 (이탈 시 상승 파동 종료)'
		},
		exitRule: {
			title: '기계적 분할 익절 가이드',
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
		listViewArea.style.display = hasStocks ? 'block' : 'none';
		cardViewArea.style.display = hasStocks ? 'block' : 'none';
		renderListView();
		if (currentSelectedTicker) renderCard(currentSelectedTicker);
		return;
	}

	if (mode === 'card') {
		btnCard.classList.add('active');
		btnList.classList.remove('active');
		if (chipWrapper) chipWrapper.style.display = 'block';
		listViewArea.style.display = 'none';
		cardViewArea.style.display = hasStocks ? 'block' : 'none';
		if (currentSelectedTicker) {
			selectTicker(currentSelectedTicker, null, true);
		}
	} else {
		btnList.classList.add('active');
		btnCard.classList.remove('active');
		if (chipWrapper) chipWrapper.style.display = 'none';
		cardViewArea.style.display = 'none';
		listViewArea.style.display = hasStocks ? 'block' : 'none';
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
		const athDiff = item.drawdownATH && item.drawdownATH !== '-' ? `ATH ${item.drawdownATH}` : 'ATH -';

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

window.addEventListener('DOMContentLoaded', () => {
	AppAlert.init();
	fetchStockData();

	const container = document.getElementById('chipContainer');
	const wrapper = document.getElementById('chipWrapper');
	if (container && wrapper) {
		container.addEventListener('scroll', () => {
			const isEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
			wrapper.classList.toggle('at-end', isEnd);
		});
	}

	document.getElementById('btnAddChip').onclick = () => openAddStockDialog('');
	document.getElementById('btnDeleteStock').onclick = handleDeleteStockDialog;
	document.getElementById('btnEditStock').onclick = handleEditStockDialog;

	document.getElementById('swalInput').onkeydown = (e) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			document.getElementById('swalConfirmBtn').click();
		}
	};

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
		document.getElementById('valSP500').innerText = res.market.sp500.price || '-';
		const spPill = document.getElementById('pillSP500');
		spPill.innerText = res.market.sp500.diffText || '-';
		spPill.className = 'market-pill ' + (res.market.sp500.pass ? 'market-up' : 'market-down');

		document.getElementById('valNASDAQ').innerText = res.market.nasdaq.price || '-';
		const nqPill = document.getElementById('pillNASDAQ');
		nqPill.innerText = res.market.nasdaq.diffText || '-';
		nqPill.className = 'market-pill ' + (res.market.nasdaq.pass ? 'market-up' : 'market-down');

		updateMacroHeaderBadge(res.market.sp500.pass, res.market.nasdaq.pass);
	}

	document.getElementById('statusMsg').style.display = 'none';
	renderChips(preferredTicker);
	switchViewMode(keepViewMode ? currentViewMode : (isPCLayout() ? 'list' : 'list'));
}

async function fetchStockData(preferredTicker = null, isManualRefresh = false) {
	const refreshBtn = document.getElementById('btnRefresh');
	if (refreshBtn) refreshBtn.classList.add('spinning');

	if (!isManualRefresh) {
		document.getElementById('statusMsg').style.display = 'block';
		document.getElementById('statusMsg').innerText = "데이터 동기화 중...";
	}

	try {
		const res = await callBackendApi('getAll');
		isDataLoaded = true;
		if (!res || !res.success) {
			AppAlert.error('로딩 실패', res ? res.error : "데이터 로딩 실패");
			document.getElementById('statusMsg').innerText = "데이터를 불러오지 못했습니다.";
			return;
		}
		applyServerResponse(res, preferredTicker, isManualRefresh);
	} catch (err) {
		isDataLoaded = true;
		document.getElementById('statusMsg').style.display = 'block';
		document.getElementById('statusMsg').innerText = "통신 오류: " + err.message;
	} finally {
		if (refreshBtn) refreshBtn.classList.remove('spinning');
	}
}

function updateMacroHeaderBadge(spPass, nqPass) {
	const badgeEl = document.getElementById('macroStatusBadge');
	const dotEl = document.getElementById('macroStatusDot');
	const textEl = document.getElementById('macroStatusText');

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

	if (tickers.length === 0) {
		currentSelectedTicker = null;
		document.getElementById('statusMsg').style.display = 'block';
		document.getElementById('statusMsg').innerText = "등록된 종목이 없습니다. 새 종목을 추가해 보세요.";
		document.getElementById('cardViewArea').style.display = 'none';
		document.getElementById('listViewArea').style.display = 'none';
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

	// 리스트 뷰 항목 선택 하이라이트
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

	document.getElementById('resTicker').innerText = data.ticker || '-';
	const finLink = document.getElementById('linkFinviz');
	const isKR = data.isKR === true;

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

	document.getElementById('resCorpName').innerText = (data.name && data.name !== data.ticker) ? data.name : '';
	document.getElementById('resPrice').innerText = data.currentPrice || '-';

	// 상태 배지 판정
	const badge = document.getElementById('decisionBadge');
	badge.innerText = data.decision || '-';
	badge.className = 'badge ' + getBadgeClass(data.decision);

	// 52주 신고가 대비 이격도
	const numP = parseFloat(String(data.currentPrice || '').replace(/[^0-9.-]+/g, ''));
	const numATH = parseFloat(String(data.high52 || '').replace(/[^0-9.-]+/g, ''));
	const pill = document.getElementById('resATHPill');

	let athDiffVal = 0;
	let isNearATH = false;
	if (!isNaN(numP) && !isNaN(numATH) && numATH > 0) {
		athDiffVal = ((numP - numATH) / numATH * 100).toFixed(1);
		isNearATH = athDiffVal >= -2.0;
	}
	pill.innerText = isNearATH ? '★ 52W 신고가 돌파' : ('신고가 대비 ' + athDiffVal + '%');
	pill.className = 'trend-pill ' + (isNearATH ? 'trend-up' : 'trend-down');

	// 통계 1: 52주 최고가
	document.getElementById('resHigh52').innerText = data.high52 || '-';
	const ddEl = document.getElementById('resDrawdownATH');
	if (data.drawdownATH && data.drawdownATH !== '-') {
		ddEl.innerText = `(${data.drawdownATH})`;
		ddEl.style.display = 'inline';
	} else {
		ddEl.style.display = 'none';
	}

	// 통계 2: 30일 박스권 범위
	document.getElementById('resBoxLow').innerText = data.boxLow || '-';
	document.getElementById('resBoxHigh').innerText = data.boxHigh || '-';
	document.getElementById('resBoxRangeBadge').innerText = `폭 ${data.boxRange || '-'}`;

	// 통계 3: 5·10·20MA 이평선 수치 및 돌파 여부
	const numMA5 = parseFloat(String(data.ma5 || '').replace(/[^0-9.-]+/g, ''));
	const numMA10 = parseFloat(String(data.ma10 || '').replace(/[^0-9.-]+/g, ''));
	const numMA20 = parseFloat(String(data.ma20 || '').replace(/[^0-9.-]+/g, ''));

	const chip5 = document.getElementById('chipMA5');
	const chip10 = document.getElementById('chipMA10');
	const chip20 = document.getElementById('chipMA20');

	chip5.innerText = `5: ${data.ma5 || '-'}`;
	chip10.innerText = `10: ${data.ma10 || '-'}`;
	chip20.innerText = `20: ${data.ma20 || '-'}`;

	if (!isNaN(numP)) {
		chip5.className = 'ma-chip ' + (!isNaN(numMA5) ? (numP >= numMA5 ? 'pass' : 'broken') : '');
		chip10.className = 'ma-chip ' + (!isNaN(numMA10) ? (numP >= numMA10 ? 'pass' : 'broken') : '');
		chip20.className = 'ma-chip ' + (!isNaN(numMA20) ? (numP >= numMA20 ? 'pass' : 'broken') : '');
	}

	// 통계 4: 다음 익절 경고선 (5·10·20선 순차적 안내)
	const nextExitEl = document.getElementById('resNextExitLine');
	if (!isNaN(numP) && !isNaN(numMA5) && numP >= numMA5) {
		nextExitEl.innerText = `5MA (${data.ma5}) 하회 시 30% 매도`;
		nextExitEl.className = 'stat-val blue';
	} else if (!isNaN(numP) && !isNaN(numMA10) && numP >= numMA10) {
		nextExitEl.innerText = `10MA (${data.ma10}) 하회 시 30% 매도`;
		nextExitEl.className = 'stat-val red';
	} else if (!isNaN(numP) && !isNaN(numMA20) && numP >= numMA20) {
		nextExitEl.innerText = `20MA (${data.ma20}) 하회 시 전량 매도`;
		nextExitEl.className = 'stat-val red';
	} else {
		nextExitEl.innerText = '추세 이탈 정리 완료';
		nextExitEl.className = 'stat-val';
		nextExitEl.style.color = '#8b95a1';
	}

	document.getElementById('resTradeTime').innerText = data.tradeTime || "-";

	if (isPCLayout() || currentViewMode === 'card') {
		document.getElementById('cardViewArea').style.display = 'block';
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