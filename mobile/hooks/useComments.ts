import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  profiles: { username: string };
};

export function useComments(markerId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  const fetchComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, profiles(username)')
      .eq('marker_id', markerId)
      .order('created_at', { ascending: true });
    setComments((data as Comment[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments:${markerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `marker_id=eq.${markerId}` },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [markerId]);

  const addComment = async (body: string) => {
    if (!user) return;
    await supabase.from('comments').insert({ marker_id: markerId, user_id: user.id, body });
  };

  return { comments, loading, addComment };
}
