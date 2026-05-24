import { create } from 'zustand';
import { useEffect } from 'react';
import api from '../lib/api';

interface User { id:number; name:string; email:string; role:string; companyId?:number }
interface AuthStore { user:User|null; loading:boolean; setUser:(u:User|null)=>void; logout:()=>void; }
export const useAuthStore = create<AuthStore>((set) => ({
  user: null, loading: true,
  setUser: (u) => set({ user: u, loading: false }),
  logout: () => { localStorage.removeItem('cortexbuild_token'); set({ user:null, loading:false }); window.location.href='/login'; },
}));

export function useAuth() {
  const store = useAuthStore();
  useEffect(() => {
    const token = localStorage.getItem('cortexbuild_token');
    if (!token) { store.setUser(null); return; }
    api.get('/auth/me').then(r => store.setUser(r.data.data ?? null)).catch(() => store.logout());
  }, []);
  return store;
}
