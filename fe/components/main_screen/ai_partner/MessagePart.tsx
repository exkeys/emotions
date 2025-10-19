import { SET_MESSAGE, createWelcomeMessages } from '@/constants/messageContents';
import { COLORS, FONTS, SIZES } from '@/constants/theme';
import { API_BASE_URL } from '@/constants/config';
import { Message } from "@/types";
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from "react";
import { ListRenderItem, StyleSheet, Text, TextInput, TouchableOpacity, View, Keyboard } from "react-native";
import { FlatList } from 'react-native-gesture-handler';
import { supabase } from "@/lib/supabase";
import AsyncStorage from '@react-native-async-storage/async-storage';

const MessagePart = () => {
  const [input, setInput] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(SET_MESSAGE);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("님");
  const flatListRef = useRef<FlatList>(null);

  // 강제 스크롤 함수 
  const forceScrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false });
    }, 50);
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  // 사용자 이름 가져오기
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const storedProfile = await AsyncStorage.getItem('@user_profile');
        if (storedProfile) {
          const profile = JSON.parse(storedProfile);
          setUserName(profile.nickname || "님");
        }
      } catch (error) {
        console.error('사용자 이름 로드 실패:', error);
      }
    };
    
    loadUserName();
  }, []);

  // 현재 로그인된 사용자 정보 가져오기
  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error('Error getting user:', error.message);
          return;
        }
        if (user) {
          setUserId(user.id);
        }
      } catch (error) {
        console.error('Error in getCurrentUser:', error);
      }
    };

    getCurrentUser();
  }, []);
  
  // 이전 대화 기록 불러오기
  const fetchChatHistory = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/history?user_id=${userId}`);
      const data = await response.json();
      
      if (response.ok && data.chatHistory) {
        // 시간순으로 정렬 (과거 → 현재)
        const sortedHistory = data.chatHistory.sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        const formattedMessages: Message[] = sortedHistory
          .map((chat: any, index: number) => [
            // 사용자 메시지
            {
              id: `history-${index}-user-${chat.created_at}`,
              text: chat.user_chat,
              user: true,
              createdAt: format(new Date(chat.created_at), 'p'),
            },
            // AI 응답
            {
              id: `history-${index}-ai-${chat.created_at}`,
              text: chat.ai_answer,
              user: false,
              createdAt: format(new Date(chat.created_at), 'p'),
            }
          ]).flat();
        
        // 환영 메시지 + 채팅 기록 조합
        const welcomeMessages = [...createWelcomeMessages(userName), ...formattedMessages];
        setMessages(welcomeMessages);
        
        // 채팅 기록 로드 후 맨 아래로 스크롤 (강제 스크롤 사용)
        forceScrollToBottom();
      } else {
        // 채팅 기록이 없으면 환영 메시지만 표시
        setMessages(createWelcomeMessages(userName));
      }
    } catch (error) {
      console.error('Failed to fetch chat history:', error);
      // 에러 시에도 환영 메시지는 표시
      setMessages(createWelcomeMessages(userName));
    }
  }, [userId, userName]);

  useEffect(() => {
    // 사용자 ID가 없으면 채팅 기록을 가져오지 않음
    if (!userId) return;
    fetchChatHistory();
  }, [userId, fetchChatHistory]);

  // 키보드 이벤트 리스너
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      forceScrollToBottom();
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      forceScrollToBottom();
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, [forceScrollToBottom]);
  
  const onSend = useCallback(async () => {
    if (!userId) {
      // 로그인하지 않은 경우 에러 메시지 표시
      const errorMessage: Message = {
        id: `login-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        text: '채팅을 사용하려면 로그인이 필요합니다.',
        user: false,
        createdAt: format(new Date(), 'p'),
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    if (input.trim().length > 0) {
      const newMessage: Message = { 
        id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
        text: input, 
        user: true,
        createdAt: format(new Date(), 'p'), // ex) 1:15 AM
      };
      setMessages(prev => [...prev, newMessage]);
      setInput('');
      
      // 메시지 추가 후 자동 스크롤
      forceScrollToBottom();
      
      try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: input,
            user_id: userId
          }),
        });

        const data = await response.json();
        
        if (response.ok) {
          const aiResponse: Message = { 
            id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
            text: data.aiResponse, 
            user: false,
            createdAt: format(new Date(), 'p'),
            chartData: data.chartData, // 차트 데이터 추가
          };
          setMessages(prev => [...prev, aiResponse]);
          
          // AI 응답 후 자동 스크롤
          forceScrollToBottom();
        } else {
          // 에러 발생 시 사용자에게 알림
          const errorMessage: Message = {
            id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: '죄송합니다. 메시지 전송 중 오류가 발생했습니다.',
            user: false,
            createdAt: format(new Date(), 'p'),
          };
          setMessages(prev => [...prev, errorMessage]);
          forceScrollToBottom();
        }
      } catch (error) {
        console.error('Chat error:', error);
        const errorMessage: Message = {
          id: `network-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          text: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
          user: false,
          createdAt: format(new Date(), 'p'),
        };
        setMessages(prev => [...prev, errorMessage]);
        forceScrollToBottom();
      }
    }
  }, [input, userId]);

  const renderItem: ListRenderItem<Message> = ({ item }) => (
    <View>
      {item.user ? (
        <View style={styles.user}>
          <Text style={styles.time}>{item.createdAt}</Text>
          <View style={styles.userMessageContainer}>
            <Text style={styles.userMessageText}>{item.text}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.ai}>
          <View style={styles.aiMessageContainer}>
            <Text style={styles.aiMessageText}>{item.text}</Text>
            {/* 차트 표시 */}
            {item.chartData && (
              <View style={styles.chartContainer}>
                <Text style={styles.chartTitle}>📊 분석 차트</Text>
                <View style={styles.chartPlaceholder}>
                  <Text style={styles.chartText}>
                    차트 타입: {item.chartData.type}
                  </Text>
                  <Text style={styles.chartText}>
                    데이터 포인트: {item.chartData.data?.datasets?.[0]?.data?.length || 0}개
                  </Text>
                  <Text style={styles.chartText}>
                    라벨: {item.chartData.data?.labels?.join(', ') || '없음'}
                  </Text>
                </View>
              </View>
            )}
          </View>
          <Text style={styles.time}>{item.createdAt}</Text>
        </View>
      )}
    </View>
  );
  
  return (
    <View style= {{ flex: 1 }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: SIZES.medium, flexGrow: 1, justifyContent: 'flex-end' }}
        style={{ flex: 1 }}
        inverted={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={input}
          onChangeText={setInput}
          multiline
          placeholder="메시지 입력"
          placeholderTextColor={COLORS.darkBlueGray}
        />
        <TouchableOpacity style={styles.sendButton} onPress={onSend}>
          <Feather name="send" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  time: {
    fontSize: 10,
  },
  user: { 
    maxWidth: '90%', 
    flexDirection: 'row', 
    alignSelf: 'flex-end', 
    alignItems: 'flex-end',
  },
  ai: { 
    maxWidth: '90%', 
    flexDirection: 'row', 
    alignSelf: 'flex-start', 
    alignItems: 'flex-end' 
  },
  userMessageContainer: {
    backgroundColor: COLORS.secondary,
    borderBottomRightRadius: 0,
    paddingHorizontal: SIZES.medium,
    paddingVertical: 10,
    borderRadius: SIZES.medium,
    marginTop: SIZES.small,
    marginLeft: 5,
    flexShrink: 1,
  },
  aiMessageContainer: {
    backgroundColor: COLORS.white,
    borderWidth: 0.3,
    borderColor: COLORS.gray,
    borderBottomLeftRadius: 0,
    paddingHorizontal: SIZES.medium,
    paddingVertical: 10,
    borderRadius: SIZES.medium,
    marginTop: SIZES.small,
    marginRight: 5,
    flexShrink: 1,
  },
  userMessageText: { 
    ...FONTS.body, 
    color: COLORS.white,
  },
  aiMessageText: { 
    ...FONTS.body, 
    color: COLORS.black,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: SIZES.small,
    alignItems: 'flex-end',
    paddingBottom: 20,
    paddingTop: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 25,
    paddingHorizontal: SIZES.medium,
    ...FONTS.body,
    minHeight: 40,
    maxHeight: 85,
  },
  sendButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SIZES.small,
  },
  chartContainer: {
    marginTop: SIZES.small,
    padding: SIZES.small,
    backgroundColor: COLORS.lightGray,
    borderRadius: SIZES.small,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  chartTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: SIZES.small,
    textAlign: 'center',
  },
  chartPlaceholder: {
    backgroundColor: COLORS.white,
    padding: SIZES.small,
    borderRadius: SIZES.small,
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  chartText: {
    ...FONTS.body,
    color: COLORS.black,
    marginBottom: 4,
  },
})

export default MessagePart;