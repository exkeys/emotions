import { openai } from '../../config/openai.js';
import { supabase } from '../../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

// dayjs 플러그인 설정
dayjs.extend(utc);
dayjs.extend(timezone);

// 분리된 모듈들 import
import { textFilter } from './textFilter.js';
import { analyzeUserIntent, calculateDateRange } from './intentAnalyze.js';
import { generateEmotionChart } from './chartGenerator.js';


async function handleSmartRequest(req, res, intent, user_id, messageId) {
	try {
		// AI가 스스로 판단: 데이터가 필요한지 확인
		const needsData = await checkIfNeedsData(req.body.message, intent);
		
		if (!needsData) {
			// 데이터 불필요 → AI가 직접 답변
			await handleSimpleRequest(req, res, intent, user_id, messageId);
		} else {
			// 데이터 필요 → 조회 후 답변
			await handleRequest(req, res, intent, user_id, messageId);
		}
	} catch (error) {
		console.error('Smart request error:', error);
		res.status(500).json({ error: '요청 처리 중 오류가 발생했습니다.' });
	}
}

// 데이터 필요 여부 확인 함수
async function checkIfNeedsData(message, intent) {
	try {
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `사용자 질문을 분석해서 데이터베이스 조회가 필요한지 판단해주세요.

**데이터 조회 필요:**
- "오늘 기록 분석해줘", "10월 보여줘", "어제 피곤함은?", "이번 주 패턴은?"
- 기록, 분석, 차트, 데이터, 피곤함, 감정 관련 질문

**데이터 조회 불필요:**
- "오늘 몇일이야?", "안녕하세요", "고마워", "날씨는?", "시간이 몇시야?"
- 일반적인 대화, 시간/날짜 질문, 인사

JSON 형식으로 답변: {"needsData": true/false}`
				},
				{
					role: 'user',
					content: `질문: "${message}"`
				}
			],
			max_tokens: 50,
			temperature: 0.1
		});

		const response = completion?.choices?.[0]?.message?.content;
		const parsed = JSON.parse(response);
		return parsed.needsData || false;
	} catch (error) {
		console.error('Data check error:', error);
		// 에러 시 의도 분석 결과 사용
		return intent.needsRecords || intent.isAnalysisRequest;
	}
}

// 간단한 질문 처리 함수
async function handleSimpleRequest(req, res, intent, user_id, messageId) {
	try {
		// 현재 날짜 정보 추가
		const now = dayjs();
		const koreaTime = now.tz('Asia/Seoul');
		const currentDate = koreaTime.format('YYYY년 MM월 DD일');
		const currentTime = koreaTime.format('HH:mm');
		
		// 간단한 AI 응답
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `너는 한국어로 답하는 따뜻한 부모 상담 AI야. 간단한 질문에 친근하게 답변해줘.

**현재 정보:**
- 오늘 날짜: ${currentDate}
- 현재 시간: ${currentTime}
- 요일: ${koreaTime.format('dddd')}

날짜나 시간 관련 질문이면 위 정보를 사용해서 정확하게 답변해줘.`
				},
				{
					role: 'user',
					content: req.body.message
				}
			],
			max_tokens: 150,
			temperature: 0.7
		});

		const aiResponse = completion?.choices?.[0]?.message?.content || '죄송하지만 다시 시도해 주시면 감사하겠습니다.';

		// 응답
		const responseData = {
			aiResponse: aiResponse,
			analysisType: 'conversation',
			dateRange: null,
			isAnalysis: false,
			chatHistory: [],
			chartData: null
		};

		res.json(responseData);

		// AI 답변 저장
		supabase
			.from('chat_messages')
			.update({ ai_answer: aiResponse })
			.eq('id', messageId)
			.then(() => null)
			.catch((e) => console.error('AI answer update error:', e?.message || e));

	} catch (error) {
		console.error('Simple request error:', error);
		res.status(500).json({ error: '요청 처리 중 오류가 발생했습니다.' });
	}
}

// 통합 요청 처리 함수
async function handleRequest(req, res, intent, user_id, messageId) {
	try {
		// 1. 데이터 조회
		const data = await getData(intent, user_id);
		
		// 2. 데이터 없으면 바로 응답
		if (!data || data.length === 0) {
			const responseData = {
				aiResponse: "해당 기간에 기록이 없습니다. 먼저 기록을 추가해주세요.",
				analysisType: intent.analysisType || 'period',
				dateRange: getDateRangeDisplay(intent),
				isAnalysis: intent.isAnalysisRequest || false,
				chatHistory: [],
				chartData: {
					type: 'message',
					message: '해당 기간에 차트를 생성할 수 있는 데이터가 없습니다.',
					noData: true
				}
			};
			res.json(responseData);
			return;
		}
		
		// 3. 데이터 있으면 분석
		const analysisResult = await analyzeData(data, intent);
		
		// 4. 차트 생성 (필요한 경우)
		let chartData = null;
		if (intent.needsChart) {
			chartData = generateEmotionChart(data, req.body.message);
		}
		
		// 5. 응답
		const responseData = {
			aiResponse: analysisResult.result,
			analysisType: intent.analysisType || 'period',
			dateRange: getDateRangeDisplay(intent),
			isAnalysis: intent.isAnalysisRequest || false,
			chatHistory: [],
			chartData: chartData
		};
		
		res.json(responseData);
		
		// 6. AI 답변 저장
		supabase
			.from('chat_messages')
			.update({ ai_answer: analysisResult.result })
			.eq('id', messageId)
			.then(() => null)
			.catch((e) => console.error('AI answer update error:', e?.message || e));
			
	} catch (error) {
		console.error('Request handling error:', error);
		res.status(500).json({ error: '요청 처리 중 오류가 발생했습니다.' });
	}
}

// 데이터 조회 함수
async function getData(intent, user_id) {
	let fromDate, toDate;
	
	// 🚨 AI의 잘못된 날짜 무시하고 직접 계산
	if (intent.timeRange === 'today') {
		const now = dayjs();
		const koreaTime = now.tz('Asia/Seoul');
		fromDate = toDate = koreaTime.format('YYYY-MM-DD');
	} else if (intent.timeRange === 'yesterday') {
		const now = dayjs();
		const koreaTime = now.tz('Asia/Seoul');
		fromDate = toDate = koreaTime.subtract(1, 'day').format('YYYY-MM-DD');
	} else if (intent.analysisType === 'custom' && intent.fromDate && intent.toDate) {
		// 커스텀 날짜만 AI 결과 사용 (월별 분석 등)
		fromDate = intent.fromDate;
		toDate = intent.toDate;
	} else {
		// 기간 분석의 경우
		fromDate = intent.fromDate || calculateDateRange(intent.periodType || 'month', intent.periodValue || 1).fromDate;
		toDate = intent.toDate || calculateDateRange(intent.periodType || 'month', intent.periodValue || 1).toDate;
	}
	
	console.log('📊 데이터 조회:', { fromDate, toDate });
	
	// 데이터 조회
	const { data: records } = await supabase
		.from('records')
		.select('date, title, notes, fatigue, emotion')
		.eq('user_id', user_id)
		.gte('date', fromDate)
		.lte('date', toDate)
		.order('date', { ascending: true });
	
	return records || [];
}

// 데이터 분석 함수
async function analyzeData(data, intent) {
	// 데이터 포맷팅
	const formatted = data
		.sort((a, b) => new Date(a.date) - new Date(b.date))
		.map(row => {
			const fatigue = Number(row.fatigue);
			let fatigueText;
			if (Number.isFinite(fatigue)) {
				if (fatigue >= 9) fatigueText = '극도로 피곤';
				else if (fatigue >= 7) fatigueText = '매우 피곤';
				else if (fatigue >= 5) fatigueText = '보통 피곤';
				else if (fatigue >= 3) fatigueText = '약간 피곤';
				else fatigueText = '전혀 안 피곤';
			} else {
				fatigueText = '점수 없음';
			}
			
			const emotion = row.emotion ? `감정: ${row.emotion}` : '';
			return `${row.date}: 피곤함 ${fatigue}점(${fatigueText}) (${row.notes?.trim() || '기록 없음'})${emotion ? ' | ' + emotion : ''}`;
		})
		.join('\n');

	const systemPrompt = `너는 한국어로 답하는 따뜻한 부모 상담 AI야. 항상 한국어만 사용하고, 영어 등급(very good, okay 등)이나 내부 코드 라벨은 사용하지 마. 사용자는 일반 부모와 자폐/발달장애/ADHD 등 특별한 필요가 있는 아동의 부모일 수 있어. 숫자가 클수록 더 피곤함(1=전혀, 10=극도로). 부모님의 노고를 인정하고 격려하며, 실용적인 조언을 제공해줘.

	**🚨 절대 금지 사항:**
	- **절대로 가짜 데이터나 존재하지 않는 기록을 만들어내지 마**
	- **절대로 추측이나 가정으로 데이터를 생성하지 마**
	- **제공된 기록 데이터만 사용하고, 없으면 없다고 명확히 말해줘**
	- **"아마도", "추정으로는", "예상으로는" 같은 표현으로 가짜 정보를 만들지 마**`;
	
	const userPrompt = `다음은 부모의 일/주간 피곤함 기록(1~10, 높을수록 피곤)입니다:\n${formatted}\n\n요구사항:\n- 1문장 요약\n- 관찰된 패턴 2~3개(증가/감소/반복 시점, 주말/평일 차이 등)\n- 실행 계획 3가지(아동 지원 2, 부모 자기돌봄 1: 작게 시작)\n- 격려와 응원 메시지`;

	try {
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: userPrompt }
			],
			max_tokens: 290,
			temperature: 0.6
		});

		const aiResponse = completion?.choices?.[0]?.message?.content || '분석을 생성할 수 없습니다.';
		return { result: aiResponse, cached: false };
	} catch (error) {
		return { error: 'AI 분석 실패', details: error?.message };
	}
}

// 날짜 범위 표시 함수
function getDateRangeDisplay(intent) {
	if (intent.analysisType === 'specific' && intent.timeRange) {
		const now = dayjs();
		const koreaTime = now.tz('Asia/Seoul');
		
		if (intent.timeRange === 'today') {
			return koreaTime.format('YYYY-MM-DD');
		} else if (intent.timeRange === 'yesterday') {
			return koreaTime.subtract(1, 'day').format('YYYY-MM-DD');
		} else {
			return koreaTime.format('YYYY-MM-DD');
		}
	} else if (intent.fromDate && intent.toDate) {
		return `${intent.fromDate} ~ ${intent.toDate}`;
	} else {
		return `최근 ${intent.periodValue || 1}${intent.periodType || 'month'}`;
	}
}

// 메인 채팅 요청 처리 함수
export async function handleChatRequest(req, res) {
	try {
		const { message, user_id = 'test_user' } = req.body;
		const trimmed = typeof message === 'string' ? message.trim() : '';
		if (!trimmed) {
			return res.status(400).json({ error: 'Message is required' });
		}

		// 1. 사용자 의도 분석
		let intent;
		try {
			intent = await analyzeUserIntent(trimmed);
			console.log('🔍 의도 분석 결과:', intent);
		} catch (error) {
			console.error('의도 분석 실패, 기본값 사용:', error);
			// 의도 분석 실패 시 기본값 사용
			intent = {
				isAnalysisRequest: false,
				needsRecords: true,
				needsChatHistory: true,
				needsChart: false,
				isSimpleGreeting: false,
				timeRange: 'recent',
				topic: null,
				analysisType: null,
				periodType: null,
				periodValue: null,
				fromDate: null,
				toDate: null
			};
		}

		// 2. 메시지 ID 생성 및 저장
		const messageId = uuidv4();
		const { error: insertError } = await supabase
			.from('chat_messages')
			.insert({ id: messageId, user_id, user_chat: trimmed, ai_answer: null });
		
		if (insertError) {
			console.error('User message insert error:', insertError);
			return res.status(500).json({ error: '메시지 저장 실패' });
		}

		// 3. AI가 스스로 판단해서 처리
		await handleSmartRequest(req, res, intent, user_id, messageId);

	} catch (error) {
		console.error('🚨 Chatbot error:', error);
		console.error('🚨 Error stack:', error.stack);
		res.status(500).json({ 
			error: '분석 처리 중 오류가 발생했습니다.',
			details: error.message 
		});
	}
}