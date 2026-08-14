import { Redirect, useLocalSearchParams } from 'expo-router';

export default function SelfManagedClaimDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  if (!id) return <Redirect href="/customer/claims" />;
  return <Redirect href={{ pathname: '/customer/claim-detail', params: { id } }} />;
}
