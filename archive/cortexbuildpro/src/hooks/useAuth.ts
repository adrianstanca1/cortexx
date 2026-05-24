import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useOrganisationStore } from "@/stores/organisationStore";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const { user, session, isLoading, setUser, setSession, setLoading, signOut: storeSignOut } = useAuthStore();
  const { setOrg: _setOrg, signOut: orgSignOut } = useOrganisationStore();

  useEffect(() => {
    let mounted = true;

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const mappedUser = session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? "",
            fullName: session.user.user_metadata?.full_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            role: (session.user.user_metadata?.role ?? "worker") as any,
            orgId: session.user.user_metadata?.org_id,
          }
        : null;

      setSession(session);
      setUser(mappedUser);
      setLoading(false);

      if (event === "SIGNED_OUT") {
        orgSignOut();
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      const mappedUser = session?.user
        ? {
            id: session.user.id,
            email: session.user.email ?? "",
            fullName: session.user.user_metadata?.full_name,
            avatarUrl: session.user.user_metadata?.avatar_url,
            role: (session.user.user_metadata?.role ?? "worker") as any,
            orgId: session.user.user_metadata?.org_id,
          }
        : null;
      setSession(session);
      setUser(mappedUser);
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [setLoading, setSession, setUser, orgSignOut]);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
    storeSignOut();
    orgSignOut();
  }

  return { signIn, signUp, signOut, user, session, isLoading };
}
