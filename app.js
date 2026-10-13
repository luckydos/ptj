/**
 * PTJ 200일선 전략 스캐너 - Frontend Logic (app.js)
 */

// [필수 설정] Google Apps Script 웹앱 배포 URL(https://script.google.com/macros/s/.../exec) 입력
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwr_ISMhOrRanQOZwEyX-Ee985ZwxMxCG9JONLc2kr1si68R48QER9Ra_xa48fgzg9T/exec";

/**
 * 백엔드 API 통합 호출 함수
 * - GitHub Pages 환경: fetch() POST (text/plain으로 CORS Preflight 완벽 우회)
 * - GAS 내부 미리보기 환경: google.script.run 자동 폴백 지원
 */
async function callBackendApi(action, payload = {}) {
	// 1. GAS 자체 HtmlService 내부에서 실행 중일 경우
	if (typeof google !== 'undefined' && google.script && google.script.run) {
		return new Promise((resolve, reject) => {
			const runner = google.script.run.withSuccessHandler(resolve).withFailureHandler(reject);
			if (action === 'getAll') runner.getAllStockData();
			else if (action === 'add') runner.addNewStock(payload.ticker);
			else if (action === 'update') runner.updateTicker(payload.oldTicker, payload.newTicker);
			else if (action === 'delete') runner.deleteStock(payload.ticker);
		});
	}

	// 2. GitHub Pages 등 외부 프론트엔드 환경에서 실행 중일 경우
	if (!GAS_WEB_APP_URL || GAS_WEB_APP_URL.includes("여기에_")) {
		throw new Error("app.js 파일 상단의 GAS_WEB_APP_URL에 구글 스크립트 배포 주소를 입력해 주세요.");
	}

	const response = await fetch(GAS_WEB_APP_URL, {
		method: 'POST',
		headers: {
			// application/json 대신 text/plain을 사용하여 CORS OPTIONS 프리플라이트 에러 방지
			'Content-Type': 'text/plain;charset=utf-8'
		},
		body: JSON.stringify({ action, ...payload })
	});

	if (!response.ok) {
		throw new Error(`HTTP 통신 오류 (${response.status})`);
	}

	return await response.json();
}

// 모달 알림창 컨트롤러
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

// 전역 상태 관리
let stockDataStore = {};
let marketDataStore = null;
let isDataLoaded = false;
let currentSelectedTicker = null;
let isAnimating = false;
let currentViewMode = 'list';
let currentTargetStage = 1; // 1: 1차 목표가(50%), 2: 2차 20일선(잔여 50%)

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
			text: marketBoxHtml + '<b>S&P 500과 나스닥 종합지수</b>가 200일선 위에 있는지를 보여줍니다.<br><br>• <b>원칙</b>: 시장 전체가 200일선 아래(▼)일 때는 개별 종목 매매 확률이 급격히 낮아지므로 현금 비중을 확대합니다.<br><br>• <b>BULL</b>: 두 지수 모두 200선 상회<br>• <b>CAUTION</b>: 둘 중 한 지수만 200선 상회<br>• <b>BEAR</b>: 두 지수 모두 200선 하회'
		},
		decision: {
			title: '최종 전략 판정 기준',
			text: `<b>폴 튜더 존스의 추세 추종 핵심 판정 규칙입니다.</b><br><br>• <b>🟢 적극 매수</b>: 주가가 200일선 위이며, 손익비(R:R)가 <b>5:1 이상</b>인 최적 진입 자리<br><br>• <b>🟡 관망(손익비 부족)</b>: 주가가 200일선 위에 있으나 손익비가 5:1 미만 (손실 위험 대비 먹을 폭이 작음)<br><br>• <b>🔴 진입 금지(역추세)</b>: 주가가 200일선 아래에 있는 대세 하락 구간 (어떤 이유로도 매수 금지)`
		},
		ma200: {
			title: '200MA 및 이격도 기준',
			text: `<b>"내 모든 룰의 시작은 200일선이다. 200일선 아래에서는 어떤 주식도 사지 않는다."</b><br>— 전설의 트레이더 폴 튜더 존스 (PTJ)<br><br><div style="border-top:1px solid #eee;margin:6px 0;"></div>• <b>200MA (기준선)</b>: 최근 200거래일 종가 평균선<br>• <b>이격도 공식</b>: (현재가 - 200선) ÷ 200선 × 100<br>&nbsp;&nbsp;<i>(현재 주가가 200일선 대비 몇 % 위/아래에 있는지를 측정)</i><br><br><div style="border-top:1px solid #eee;margin:6px 0;"></div><b>[이격도별 실전 대응 기준]</b><br>• <b>▲ 0% ~ +7%</b> (최적 진입): 200선 지지 반등 구간. 손절선이 짧아 손익비(R:R) 극대화<br>• <b>▲ +8% ~ +15%</b> (추세 지속): 안정적 우상향 지속 구간<br>• <b>▲ +15% 이상</b> (단기 과열): 200선과 괴리가 커 평균 회귀(조정) 위험 (추격 매수 주의)<br>• <b>▼ 음수(-)</b> (역추세): 대세 하락 구간. 절대 매수 금지`
		},
		tradetime: {
			title: '최종 체결 시간',
			text: tradeTimeHtml + `• <b>데이터 기준</b>: 장중에는 실시간(지연) 체결 시각, 장 마감 후에는 최종 마감 시각이 표시됩니다.<br>• <b>시세 지연</b>: 구글 파이낸스 시세는 거래소에 따라 최대 15~20분 지연될 수 있습니다.<br>${isKR ? '' : '• <b>시차 적용</b>: 서머타임 기간 13시간, 해제 시 14시간 시차가 자동 반영됩니다.'}`
		},
		corpName: {
			title: '기업 상세명',
			text: data ? `<b>[${data.ticker}]</b><br>${data.name}` : '기업 정보 없음'
		},
		rr: {
			title: '손익비 (Risk / Reward)',
			text: '<b>예상 수익 ÷ 감수할 손실</b><br><br>• <b>계산식</b>: (최근고점 - 현재가) ÷ (현재가 - 추천손절가)<br>• <b>기준</b>: 최소 <b>5.0 이상</b>만 진입합니다.'
		},
		high: {
			title: '최근 고점 및 하락률',
			text: '<b>최근 6개월 최고가</b>와 해당 고점 대비 현재 하락률(Drawdown)을 나타냅니다.<br><br>• <b>-5% 이내</b>: 신고가 돌파 모멘텀<br>• <b>-15%~-25%</b>: 200일선 지지 눌림목 반등 구간'
		},
		target: {
			title: '2단계 하이브리드 익절 전략',
			text: '<b>[적극 매수] 종목의 실전 분할 매도 원칙입니다. (매도가 박스를 터치하면 1차/2차 가격을 전환할 수 있습니다)</b><br><br>' +
				'• <b>1차 익절 (50%)</b>: 상단 목표가(최근 고점 95% 또는 상승폭의 80%) 도달 시 보유 물량의 절반을 확실하게 차익 실현합니다.<br><br>' +
				'• <b>2차 청산 (잔여 50%)</b>: 일봉 종가가 <b>20일 이동평균선(20MA)</b>을 하향 이탈할 때까지 추세를 끝까지 추종하며 장마감 직전 전량 정리합니다.<br><br>' +
				'<div style="background:#f8fafc; padding:10px 12px; border-radius:10px; border:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center;">' +
				'  <span style="font-size:12px; font-weight:700; color:#4e5968;">현재 2차 청산선 (20MA)</span>' +
				'  <span style="font-size:13px; font-weight:800; color:#1e293b;">' + ((data && data.ma20) ? data.ma20 : '-') + '</span>' +
				'</div>'
		},
		stop: {
			title: '추천 손절가 기준',
			text: '<b>[적극 매수] 종목에만 산출됩니다.</b><br><br>상황에 따라 더 높은 방어선이 자동 채택됩니다:<br>• <b>현재가 -3.5%</b>: 주가가 200일선보다 높을 때 손실폭을 짧게 제한<br>• <b>200선 -1.0%</b>: 200일선 근처에서 살짝 흔드는 노이즈 이탈 방어'
		}
	};

	if (tips[type]) {
		AppAlert.info(tips[type].title, tips[type].text);
	}
}

function switchViewMode(mode) {
	currentViewMode = mode;
	const btnList = document.getElementById('btnViewList');
	const btnCard = document.getElementById('btnViewCard');
	const chipWrapper = document.getElementById('chipWrapper');
	const cardViewArea = document.getElementById('cardViewArea');
	const listViewArea = document.getElementById('listViewArea');

	const hasStocks = Object.keys(stockDataStore || {}).length > 0;

	if (mode === 'card') {
		btnCard.classList.add('active');
		btnList.classList.remove('active');
		chipWrapper.style.display = 'block';
		listViewArea.style.display = 'none';
		cardViewArea.style.display = hasStocks ? 'block' : 'none';
		if (currentSelectedTicker) {
			selectTicker(currentSelectedTicker, null, true);
		}
	} else {
		btnList.classList.add('active');
		btnCard.classList.remove('active');
		chipWrapper.style.display = 'none';
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
		cardEl.className = 'list-card-item';

		const numP = parseFloat(String(item.currentPrice || '').replace(/[^0-9.-]+/g, ''));
		const numM = parseFloat(String(item.ma200 || '').replace(/[^0-9.-]+/g, ''));
		const trendStr = String(item.trend || '');
		const isPass = trendStr.indexOf('상승') > -1 || trendStr.indexOf('Pass') > -1 || trendStr.indexOf('위') > -1;

		let diffText = '-';
		if (!isNaN(numP) && !isNaN(numM) && numM > 0) {
			const diff = ((numP - numM) / numM * 100).toFixed(1);
			diffText = `${isPass ? '▲ +' : '▼ '}${Math.abs(diff)}%`;
		}

		const decStr = String(item.decision || '');
		const isStrongBuy = decStr.indexOf('적극') > -1;
		const isWait = decStr.indexOf('관망') > -1;
		const badgeClass = isStrongBuy ? 'badge-buy' : (isWait ? 'badge-wait' : 'badge-fail');

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
        <span class="list-ma-label">200선</span>
        <span class="list-ma-val ${isPass ? 'up' : 'down'}">${diffText}</span>
        <div>
          <span class="list-rr-tag">R:R ${item.rrRatio || '-'}</span>
        </div>
      </div>
    `;

		cardEl.onclick = () => {
			selectTicker(t, null, true);
			switchViewMode('card');
		};
		container.appendChild(cardEl);
	});
}

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
		if (isAnimating || currentViewMode !== 'card') return;
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

// 서버 응답 데이터 공통 반영 함수
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
	switchViewMode(keepViewMode ? currentViewMode : 'list');
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
	currentTargetStage = 1; // 종목 변경 시 1차 목표가로 초기화
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

	if (shouldRender) {
		renderCard(ticker);
	}
}

// 매도가 1차(50% 목표가) <-> 2차(20MA 추세선) 토글
function toggleTargetStage() {
	if (!currentSelectedTicker || !stockDataStore[currentSelectedTicker]) return;
	currentTargetStage = currentTargetStage === 1 ? 2 : 1;
	renderTargetBox(stockDataStore[currentSelectedTicker]);
}

function renderTargetBox(data) {
	const targetEl = document.getElementById('resTarget');
	const stageBadge = document.getElementById('targetStageBadge');
	const decStr = String(data.decision || '');
	const isStrongBuy = decStr.indexOf('적극') > -1;
	const numP = parseFloat(String(data.currentPrice || '').replace(/[^0-9.-]+/g, ''));

	if (!isStrongBuy) {
		stageBadge.innerText = '1차:50%';
		stageBadge.className = 'target-stage-badge';
		targetEl.innerText = '- (매수대기)';
		targetEl.className = 'stat-val muted';
		return;
	}

	if (currentTargetStage === 1) {
		stageBadge.innerText = '1차:50%';
		stageBadge.className = 'target-stage-badge';
		const numTarget = parseFloat(String(data.targetPrice || '').replace(/[^0-9.-]+/g, ''));
		let targetYieldText = '';
		if (!isNaN(numP) && !isNaN(numTarget) && numP > 0) {
			const yieldPct = ((numTarget - numP) / numP * 100).toFixed(1);
			targetYieldText = `<span style="font-size:12px; font-weight:600; color:#1a73e8; margin-left:4px;">(${yieldPct >= 0 ? '+' : ''}${yieldPct}%)</span>`;
		}
		targetEl.innerHTML = `${data.targetPrice || '-'}${targetYieldText}`;
		targetEl.className = 'stat-val blue';
	} else {
		stageBadge.innerText = '2차:20MA';
		stageBadge.className = 'target-stage-badge stage-2';
		const numMa20 = parseFloat(String(data.ma20 || '').replace(/[^0-9.-]+/g, ''));
		let ma20DiffText = '';
		if (!isNaN(numP) && !isNaN(numMa20) && numP > 0) {
			const diffPct = ((numMa20 - numP) / numP * 100).toFixed(1);
			ma20DiffText = `<span style="font-size:12px; font-weight:600; color:#137333; margin-left:4px;">(${diffPct >= 0 ? '+' : ''}${diffPct}%)</span>`;
		}
		targetEl.innerHTML = `${data.ma20 || '-'}${ma20DiffText}`;
		targetEl.className = 'stat-val green';
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

	const badge = document.getElementById('decisionBadge');
	badge.innerText = data.decision || '-';
	const decStr = String(data.decision || '');
	const isStrongBuy = decStr.indexOf('적극') > -1;
	const isWait = decStr.indexOf('관망') > -1;
	badge.className = 'badge ' + (isStrongBuy ? 'badge-buy' : (isWait ? 'badge-wait' : 'badge-fail'));

	const numP = parseFloat(String(data.currentPrice || '').replace(/[^0-9.-]+/g, ''));
	const numM = parseFloat(String(data.ma200 || '').replace(/[^0-9.-]+/g, ''));
	const trendStr = String(data.trend || '');
	const isPass = trendStr.indexOf('상승') > -1 || trendStr.indexOf('Pass') > -1 || trendStr.indexOf('위') > -1;
	const pill = document.getElementById('resMAPill');
	const arrow = isPass ? '▲' : '▼';

	let disparityStr = '';
	if (!isNaN(numP) && !isNaN(numM) && numM > 0) {
		const diff = ((numP - numM) / numM * 100).toFixed(1);
		disparityStr = ` ${diff >= 0 ? '+' : ''}${diff}%`;
	}
	pill.innerText = `${arrow} 200MA${disparityStr} / ${data.ma200 || '-'}`;
	pill.className = 'trend-pill ' + (isPass ? 'trend-up' : 'trend-down');

	document.getElementById('resRR').innerText = data.rrRatio || '-';
	document.getElementById('resHigh').innerText = data.recentHigh || '-';

	const ddEl = document.getElementById('resDrawdown');
	if (data.drawdown && data.drawdown !== '-') {
		ddEl.innerText = `(${data.drawdown})`;
		ddEl.style.display = 'inline';
	} else {
		ddEl.style.display = 'none';
	}

	// 매도가 박스 렌더링
	renderTargetBox(data);

	// 손절가 박스 렌더링
	const stopEl = document.getElementById('resStop');
	const stopBaseEl = document.getElementById('resStopBase');

	if (isStrongBuy) {
		const numStop = parseFloat(String(data.stopLoss || '').replace(/[^0-9.-]+/g, ''));
		stopEl.innerText = data.stopLoss || '-';
		stopEl.className = 'stat-val red';

		if (!isNaN(numStop) && !isNaN(numP) && !isNaN(numM) && numStop > 0) {
			const pThreshold = numP * 0.965;
			const maThreshold = numM * 0.99;
			stopBaseEl.innerText = (maThreshold > pThreshold) ? '200선 -1%' : '현재가 -3.5%';
			stopBaseEl.style.display = 'inline-block';
		} else {
			stopBaseEl.style.display = 'none';
		}
	} else {
		stopEl.innerText = '- (미진입)';
		stopEl.className = 'stat-val muted';
		stopBaseEl.style.display = 'none';
	}

	document.getElementById('resTradeTime').innerText = data.tradeTime || "-";

	if (currentViewMode === 'card') {
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
	AppAlert.loading('데이터 계산 중', `<b>${ticker}</b> 이동평균선 및 손익비를 계산하고 있습니다...<br><span style="font-size:12px;color:#888;">(구글 파이낸스 동기화에 2~4초 소요)</span>`);
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