// 차트 템플릿 정의
export const chartTemplates = {
	weekly_emotion_trend: {
		type: 'line',
		options: { 
			responsive: true, 
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: '주간 감정 변화 추이'
				}
			}
		}
	},
	monthly_emotion_distribution: {
		type: 'bar',
		options: { 
			responsive: true, 
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: '월간 감정 분포'
				}
			}
		}
	},
	daily_emotion_ratio: {
		type: 'pie',
		options: { 
			responsive: true, 
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: '일일 감정 비율'
				}
			}
		}
	},
	emotion_comparison: {
		type: 'radar',
		options: { 
			responsive: true, 
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: '감정 비교 분석'
				}
			}
		}
	}
};

// 규칙 기반 차트 타입 선택
export function selectChartTypeByRule(question) {
	const q = question.toLowerCase();
	
	// 변화/추이 관련
	if (q.includes('변화') || q.includes('추이') || q.includes('흐름') || q.includes('패턴')) {
		return 'line';
	}
	
	// 분포/빈도 관련
	if (q.includes('분포') || q.includes('빈도') || q.includes('얼마나') || q.includes('몇번')) {
		return 'bar';
	}
	
	// 비율/구성 관련
	if (q.includes('비율') || q.includes('구성') || q.includes('퍼센트') || q.includes('비중')) {
		return 'pie';
	}
	
	// 비교/대조 관련
	if (q.includes('비교') || q.includes('대조') || q.includes('vs') || q.includes('대비')) {
		return 'radar';
	}
	
	// 기본값
	return 'line';
}

// 차트 데이터 생성 함수
export function generateChartData(emotionData, chartType) {
	if (!emotionData || emotionData.length === 0) {
		return {
			type: 'message',
			message: '해당 기간에 차트를 생성할 수 있는 데이터가 없습니다.',
			noData: true
		};
	}

	switch (chartType) {
		case 'line':
			return generateLineChart(emotionData);
		case 'bar':
			return generateBarChart(emotionData);
		case 'pie':
			return generatePieChart(emotionData);
		case 'radar':
			return generateRadarChart(emotionData);
		default:
			return generateLineChart(emotionData);
	}
}

// 선 그래프 생성 (감정 변화 추이)
function generateLineChart(emotionData) {
	const sortedData = emotionData.sort((a, b) => new Date(a.date) - new Date(b.date));
	
	return {
		type: 'line',
		data: {
			labels: sortedData.map(item => item.date),
			datasets: [{
				label: '피로도',
				data: sortedData.map(item => item.fatigue || 0),
				borderColor: 'rgb(255, 99, 132)',
				backgroundColor: 'rgba(255, 99, 132, 0.2)',
				tension: 0.1
			}]
		},
		options: chartTemplates.weekly_emotion_trend.options
	};
}

// 막대 그래프 생성 (감정 분포)
function generateBarChart(emotionData) {
	const emotionCounts = emotionData.reduce((acc, item) => {
		const emotion = item.emotion || '정보없음';
		acc[emotion] = (acc[emotion] || 0) + 1;
		return acc;
	}, {});

	const emotions = Object.keys(emotionCounts);
	const counts = Object.values(emotionCounts);

	return {
		type: 'bar',
		data: {
			labels: emotions,
			datasets: [{
				label: '빈도',
				data: counts,
				backgroundColor: [
					'rgba(255, 99, 132, 0.8)',
					'rgba(54, 162, 235, 0.8)',
					'rgba(255, 205, 86, 0.8)',
					'rgba(75, 192, 192, 0.8)',
					'rgba(153, 102, 255, 0.8)'
				]
			}]
		},
		options: chartTemplates.monthly_emotion_distribution.options
	};
}

// 원형 그래프 생성 (감정 비율)
function generatePieChart(emotionData) {
	const emotionCounts = emotionData.reduce((acc, item) => {
		const emotion = item.emotion || '정보없음';
		acc[emotion] = (acc[emotion] || 0) + 1;
		return acc;
	}, {});

	const emotions = Object.keys(emotionCounts);
	const counts = Object.values(emotionCounts);

	return {
		type: 'pie',
		data: {
			labels: emotions,
			datasets: [{
				data: counts,
				backgroundColor: [
					'rgba(255, 99, 132, 0.8)',
					'rgba(54, 162, 235, 0.8)',
					'rgba(255, 205, 86, 0.8)',
					'rgba(75, 192, 192, 0.8)',
					'rgba(153, 102, 255, 0.8)'
				]
			}]
		},
		options: chartTemplates.daily_emotion_ratio.options
	};
}

// 레이더 차트 생성 (감정 비교)
function generateRadarChart(emotionData) {
	const emotionCounts = emotionData.reduce((acc, item) => {
		const emotion = item.emotion || '정보없음';
		acc[emotion] = (acc[emotion] || 0) + 1;
		return acc;
	}, {});

	const emotions = Object.keys(emotionCounts);
	const counts = Object.values(emotionCounts);

	return {
		type: 'radar',
		data: {
			labels: emotions,
			datasets: [{
				label: '감정 빈도',
				data: counts,
				borderColor: 'rgb(255, 99, 132)',
				backgroundColor: 'rgba(255, 99, 132, 0.2)'
			}]
		},
		options: chartTemplates.emotion_comparison.options
	};
}

// 통합 차트 생성 함수 (하이브리드 방식)
export function generateEmotionChart(emotionData, question) {
	// 🚨 데이터 검증: 가짜 데이터 생성 방지
	if (!emotionData || emotionData.length === 0) {
		console.log('📊 차트 생성: 데이터가 없어서 메시지 반환');
		return {
			type: 'message',
			message: '해당 기간에 차트를 생성할 수 있는 데이터가 없습니다.',
			noData: true
		};
	}

	// 🚨 데이터 무결성 검증
	const validData = emotionData.filter(item => {
		// 필수 필드가 있는지 확인
		if (!item.date || !item.fatigue) {
			console.warn('📊 차트 생성: 유효하지 않은 데이터 필터링됨', item);
			return false;
		}
		// 날짜 형식 검증
		if (isNaN(new Date(item.date).getTime())) {
			console.warn('📊 차트 생성: 잘못된 날짜 형식 필터링됨', item.date);
			return false;
		}
		return true;
	});

	if (validData.length === 0) {
		console.log('📊 차트 생성: 유효한 데이터가 없어서 메시지 반환');
		return {
			type: 'message',
			message: '해당 기간에 유효한 데이터가 없어서 차트를 생성할 수 없습니다.',
			noData: true
		};
	}

	// 규칙 기반으로 차트 타입 선택
	const chartType = selectChartTypeByRule(question);
	
	// 차트 데이터 생성 (유효한 데이터만 사용)
	const chartData = generateChartData(validData, chartType);
	
	return chartData;
}
