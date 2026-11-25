/** Banner on every screen of the unlocked review edition (D-051). English only: an owner tool. */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

export function ReviewBanner() {
  return (
    <View
      testID="review-banner"
      accessibilityRole="header"
      style={{ backgroundColor: '#5b2a86', paddingHorizontal: 16, paddingVertical: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 12 }}
    >
      <Text style={{ color: '#fff', fontWeight: '700' }}>Review edition - everything unlocked</Text>
      <Pressable testID="review-browse" accessibilityRole="link" onPress={() => router.push('/review')} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#fff' }}>
        <Text style={{ color: '#5b2a86', fontWeight: '700' }}>Browse everything · View as</Text>
      </Pressable>
    </View>
  );
}
