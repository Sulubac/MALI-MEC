'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useApiQuery<T>(
  key: string[],
  queryFn: () => Promise<T>,
  options?: any,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn,
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useApiMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: any) => void;
    invalidateKeys?: string[][];
  },
) {
  const queryClient = useQueryClient();
  return useMutation<T, Error, V>({
    mutationFn,
    onSuccess: (data) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));
      }
      options?.onSuccess?.(data);
    },
    onError: options?.onError,
  });
}
