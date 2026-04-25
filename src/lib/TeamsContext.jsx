import { createContext, useContext, useEffect, useState } from 'react';
import { sb } from './supabase';

// Fallback defaults (used until Supabase responds or if table is empty)
const DEFAULT_TEAMS = [
  { id: 'klantenservice', label: 'Klantenservice', color: '#08AD8B', text_color: '#ffffff', sort_order: 1 },
  { id: 'commercieel',    label: 'Commercieel',    color: '#b93a39', text_color: '#ffffff', sort_order: 2 },
  { id: 'freedom',        label: 'Freedom',        color: '#ffcc00', text_color: '#1a1a1a', sort_order: 3 },
];

// Compute text color for readability given a background hex
export function computeTextColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Luminance formula
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1a1a1a' : '#ffffff';
}

const TeamsContext = createContext(DEFAULT_TEAMS);

export function TeamsProvider({ children }) {
  const [teams, setTeams] = useState(DEFAULT_TEAMS);

  const load = async () => {
    const { data, error } = await sb.from('teams').select('*').order('sort_order');
    if (!error && data?.length) {
      setTeams(data);
    }
  };

  useEffect(() => {
    load();
    const ch = sb.channel('teams_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, load)
      .subscribe();
    return () => ch.unsubscribe();
  }, []);

  return <TeamsContext.Provider value={teams}>{children}</TeamsContext.Provider>;
}

export function useTeams() {
  return useContext(TeamsContext);
}

// Helpers derived from teams array — mirrors the old constants
export function getTeamIds(teams) {
  return teams.map(t => t.id);
}

export function getTeamLabel(teams, id) {
  return teams.find(t => t.id === id)?.label || id;
}

export function getTeamColor(teams, id) {
  return teams.find(t => t.id === id)?.color || '#888';
}

export function getTeamTextColor(teams, id) {
  return teams.find(t => t.id === id)?.text_color || '#fff';
}

// ── CRUD operations ──────────────────────────────────────────────

export async function createTeam({ label, color }) {
  const text_color = computeTextColor(color);
  // stable slug from label
  const id = 'team_' + Date.now();
  const { data: existing } = await sb.from('teams').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const sort_order = (existing?.[0]?.sort_order || 0) + 1;
  const { data, error } = await sb.from('teams').insert({ id, label, color, text_color, sort_order }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTeam(id, { label, color }) {
  const patch = { label };
  if (color) {
    patch.color = color;
    patch.text_color = computeTextColor(color);
  }
  const { error } = await sb.from('teams').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteTeam(id) {
  // Check no profiles are assigned to this team
  const { data: members } = await sb.from('profiles').select('id').eq('team', id).eq('approved', true);
  if (members?.length) {
    throw new Error(`${members.length} medewerker(s) zijn nog aan dit team gekoppeld`);
  }
  const { error } = await sb.from('teams').delete().eq('id', id);
  if (error) throw error;
}
