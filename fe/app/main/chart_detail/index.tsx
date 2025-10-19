import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { COLORS, FONTS, SIZES } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';

const ChartDetailScreen = () => {
  const { chartData, chartTitle } = useLocalSearchParams();
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // 차트 데이터 파싱
  const parsedChartData = chartData ? JSON.parse(chartData as string) : null;

  if (!parsedChartData) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>차트 상세</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>차트 데이터를 불러올 수 없습니다.</Text>
        </View>
      </View>
    );
  }

  // 차트 설정
  const chartConfig = {
    backgroundColor: COLORS.white,
    backgroundGradientFrom: COLORS.white,
    backgroundGradientTo: COLORS.white,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: "8",
      strokeWidth: "3",
      stroke: COLORS.primary,
    },
  };

  // 차트 렌더링
  const renderChart = () => {
    const chartWidth = screenWidth - 40;
    const chartHeight = screenHeight * 0.6;

    switch (parsedChartData.type) {
      case 'line':
        return (
          <LineChart
            data={parsedChartData.data}
            width={chartWidth}
            height={chartHeight}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        );
      
      case 'bar':
        return (
          <BarChart
            data={parsedChartData.data}
            width={chartWidth}
            height={chartHeight}
            chartConfig={chartConfig}
            yAxisLabel=""
            yAxisSuffix=""
            style={styles.chart}
          />
        );
      
      case 'pie':
        return (
          <PieChart
            data={parsedChartData.data}
            width={chartWidth}
            height={chartHeight}
            chartConfig={chartConfig}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="15"
            style={styles.chart}
          />
        );
      
      default:
        return (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>지원하지 않는 차트 타입입니다.</Text>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chartTitle || '차트 상세'}</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 차트 컨테이너 */}
      <View style={styles.chartContainer}>
        {renderChart()}
      </View>

      {/* 차트 정보 */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>📊 차트 정보</Text>
        <Text style={styles.infoText}>타입: {parsedChartData.type}</Text>
        <Text style={styles.infoText}>
          데이터 포인트: {parsedChartData.data?.datasets?.[0]?.data?.length || 0}개
        </Text>
        <Text style={styles.infoText}>
          라벨: {parsedChartData.data?.labels?.join(', ') || '없음'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.medium,
    paddingVertical: SIZES.small,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  backButton: {
    padding: SIZES.small,
  },
  headerTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.medium,
  },
  chart: {
    borderRadius: 16,
    shadowColor: COLORS.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    padding: SIZES.medium,
    backgroundColor: COLORS.lightGray,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray,
  },
  infoTitle: {
    ...FONTS.h4,
    color: COLORS.primary,
    marginBottom: SIZES.small,
  },
  infoText: {
    ...FONTS.body,
    color: COLORS.black,
    marginBottom: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.medium,
  },
  errorText: {
    ...FONTS.body,
    color: COLORS.gray,
    textAlign: 'center',
  },
});

export default ChartDetailScreen;
