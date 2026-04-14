import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AdminService, type AdminUserRow } from '../services/adminService';
import { useAlerts } from '../contexts/AlertContext';

export default function Admin() {
  const { user, isAuthenticated } = useStore();
  const { addAlert } = useAlerts();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/', { replace: true });
      return;
    }
    if (!(user as { isAdmin?: boolean }).isAdmin) {
      addAlert('Access denied. Admin only.', 'error');
      navigate('/', { replace: true });
      return;
    }
    load();
  }, [isAuthenticated, user, navigate]);

  async function load() {
    setLoading(true);
    try {
      const list = await AdminService.listUsers();
      setUsers(list);
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function toggleVerifiedArtist(row: AdminUserRow) {
    if (togglingId) return;
    setTogglingId(row.id);
    try {
      await AdminService.setVerifiedArtist(row.id, !row.is_verified_artist);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === row.id ? { ...u, is_verified_artist: !u.is_verified_artist } : u
        )
      );
      addAlert(
        row.is_verified_artist
          ? `Verified artist turned off for ${row.username}`
          : `Verified artist turned on for ${row.username}`,
        'success'
      );
    } catch (e) {
      addAlert(e instanceof Error ? e.message : 'Update failed', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  if (!user || !(user as { isAdmin?: boolean }).isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-black"
            >
              <ArrowLeft size={20} />
            </button>
            <Shield className="w-8 h-8 text-violet-600" />
            <p className="text-2xl font-bold text-black">Admin</p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-black disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="font-semibold text-black">Users & verified artist</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Turn “Verified artist” on for rights holders so they can upload their own released tracks (copyright checks skipped).
            </p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/80">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Verified artist</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-black">{row.username}</p>
                          <p className="text-sm text-gray-500 truncate max-w-[200px]">{row.email}</p>
                          {row.artist_name && (
                            <p className="text-xs text-gray-400">{row.artist_name}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-black capitalize">{row.role}</span>
                        {row.is_admin && (
                          <span className="ml-2 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded">Admin</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={togglingId === row.id}
                          onClick={() => toggleVerifiedArtist(row)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            row.is_verified_artist
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          } disabled:opacity-50`}
                        >
                          {togglingId === row.id ? (
                            <Loader2 size={16} className="animate-spin inline" />
                          ) : row.is_verified_artist ? (
                            'Yes'
                          ) : (
                            'No'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
