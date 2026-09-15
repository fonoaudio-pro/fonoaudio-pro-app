import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';

export function useRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to all changes in public schema
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
        },
        (payload) => {
          const table = payload.table;
          console.log('[RealtimeSync] DB Change detected on table:', table, payload.eventType);

          if (table === 'patients') {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
          } else if (table === 'appointments') {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
          } else if (table === 'materials' || table === 'visual_materials') {
            queryClient.invalidateQueries({ queryKey: ['materials'] });
          } else if (table === 'consultorios') {
            queryClient.invalidateQueries({ queryKey: ['consultorios'] });
          } else {
            // General fallback: invalidate all active queries so UI updates
            queryClient.invalidateQueries();
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeSync] Subscribed to Supabase Realtime changes.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
