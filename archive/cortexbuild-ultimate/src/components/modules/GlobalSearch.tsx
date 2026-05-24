import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Briefcase,
  FileText,
  Users,
  User,
  ClipboardList,
  FolderOpen,
  Loader2,
  ArrowRight,
  History,
  Star,
  Filter,
  Sparkles,
  Brain,
  Trash2,
  Save,
  TrendingUp,
  Calendar,
  Clock,
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { searchApi } from '../../services/api';
import { toast } from 'sonner';
import { EmptyState } from '../ui/EmptyState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import clsx from 'clsx';
import { ModuleBreadcrumbs } from '../ui/Breadcrumbs';

type AnyRow = Record<string, unknown>;
type SubTab = 'search' | 'recent' | 'saved' | 'advanced' | 'bookmarks' | 'analytics';

interface SearchResult {
  [key: string]: AnyRow[] | unknown;
}

interface SemanticMatch {
  type: 'semantic';
  table: string;
  row_id: string;
  chunk_text: string;
  score: number;
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  module: string;
  resultCount: number;
  createdDate: string;
}

interface BookmarkedResult {
  id: string;
  title: string;
  type: string;
  project?: string;
  bookmarkedDate: string;
}

interface SearchAnalyticsEntry {
  date: string;
  count: number;
}

interface SearchTerm {
  term: string;
  count: number;
  category: string;
}

const resultIcons: Record<string, React.ElementType> = {
  projects: Briefcase,
  invoices: FileText,
  contacts: User,
  rfis: ClipboardList,
  documents: FolderOpen,
  team: Users,
  default: Search,
};

const resultLabels: Record<string, string> = {
  projects: 'Projects',
  invoices: 'Invoices',
  contacts: 'Contacts',
  rfis: 'RFIs',
  documents: 'Documents',
  team: 'Team',
};

export function GlobalSearch({
  onClose,
  embedded = false,
}: {
  onClose?: () => void;
  /** When true, render inline in the main area instead of a full-screen overlay */
  embedded?: boolean;
}) {
  const [subTab, setSubTab] = useState<SubTab>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [semanticResults, setSemanticResults] = useState<SemanticMatch[]>([]);
  const [searchMode, setSearchMode] = useState<string>('text');
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [bookmarkedResults, setBookmarkedResults] = useState<BookmarkedResult[]>([]);
  const [advancedFilters, setAdvancedFilters] = useState({
    module: 'all',
    status: 'all',
    dateRange: 'all',
    priority: 'all',
  });
  const [appliedFilters, setAppliedFilters] = useState<Array<{ key: string; value: string }>>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string[]>([]);
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [statusFilterAdvanced, setStatusFilterAdvanced] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [recentSearchesExpanded, setRecentSearchesExpanded] = useState(true);
  const [zeroResultSearches, setZeroResultSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('cortexbuild_search_history');
    if (saved) setHistory(JSON.parse(saved));
    const savedSearches = localStorage.getItem('cortexbuild_saved_searches');
    if (savedSearches) setSavedSearches(JSON.parse(savedSearches));
    const bookmarked = localStorage.getItem('cortexbuild_bookmarked_results');
    if (bookmarked) setBookmarkedResults(JSON.parse(bookmarked));
    const zeroResults = localStorage.getItem('cortexbuild_zero_results');
    if (zeroResults) setZeroResultSearches(JSON.parse(zeroResults));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape' && embedded === false) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [embedded, onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults(null);
      setSemanticResults([]);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await searchApi.search(query);
        setResults((data.results || {}) as SearchResult);
        setSemanticResults(((data.semanticResults || []) as unknown) as SemanticMatch[]);
        setSearchMode(data.searchMode || 'text');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Search failed';
        console.error('Search error', err);
        toast.error(msg);
        setResults(null);
        setSemanticResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const saveToHistory = (q: string) => {
    const updated = [{ query: q, timestamp: Date.now() }, ...history.filter(h => h.query !== q)].slice(0, 10);
    setHistory(updated);
    localStorage.setItem('cortexbuild_search_history', JSON.stringify(updated));
  };

  const handleSearch = () => {
    if (query.length >= 2) {
      saveToHistory(query);
      const allResults = Object.entries(results || {}).flatMap(([_type, items]) =>
        Array.isArray(items) ? items : []
      );
      if (allResults.length === 0) {
        setZeroResultSearches(prev => {
          const updated = [...new Set([...prev, query])];
          localStorage.setItem('cortexbuild_zero_results', JSON.stringify(updated));
          return updated;
        });
      }
    }
  };

  const allResults = results
    ? Object.entries(results).flatMap(([type, items]) =>
        Array.isArray(items)
          ? items.map((item: unknown, _i: number) => ({
              type,
              item: item as AnyRow,
            }))
          : []
      )
    : [];

  const totalCount = allResults.length + semanticResults.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      saveToHistory(query);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('cortexbuild_search_history');
  };

  const saveCurrentSearch = useCallback(() => {
    if (!query.trim() || !saveSearchName.trim()) {
      toast.error('Please enter a name for this search');
      return;
    }
    const newSearch: SavedSearch = {
      id: String(Date.now()),
      name: saveSearchName,
      query,
      module: advancedFilters.module,
      resultCount: allResults.length,
      createdDate: new Date().toISOString().slice(0, 10),
    };
    const updated = [newSearch, ...savedSearches].slice(0, 20);
    setSavedSearches(updated);
    localStorage.setItem('cortexbuild_saved_searches', JSON.stringify(updated));
    toast.success(`Saved search "${saveSearchName}"`);
    setSaveSearchName('');
    setShowSaveModal(false);
  }, [query, saveSearchName, advancedFilters.module, allResults.length, savedSearches]);

  const deleteSavedSearch = useCallback((id: string) => {
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    localStorage.setItem('cortexbuild_saved_searches', JSON.stringify(updated));
    toast.success('Search deleted');
  }, [savedSearches]);

  const loadSavedSearch = useCallback((search: SavedSearch) => {
    setQuery(search.query);
    setSubTab('search');
    saveToHistory(search.query);
  }, []);

  const toggleBookmark = useCallback((title: string, type: string, project?: string) => {
    const id = `${type}-${title}`;
    const existing = bookmarkedResults.find(b => b.id === id);
    if (existing) {
      const updated = bookmarkedResults.filter(b => b.id !== id);
      setBookmarkedResults(updated);
      localStorage.setItem('cortexbuild_bookmarked_results', JSON.stringify(updated));
      toast.success('Bookmark removed');
    } else {
      const newBookmark: BookmarkedResult = {
        id,
        title,
        type,
        project,
        bookmarkedDate: new Date().toISOString().slice(0, 10),
      };
      const updated = [newBookmark, ...bookmarkedResults];
      setBookmarkedResults(updated);
      localStorage.setItem('cortexbuild_bookmarked_results', JSON.stringify(updated));
      toast.success('Bookmarked');
    }
  }, [bookmarkedResults]);

  const removeFilter = useCallback((key: string) => {
    const updated = appliedFilters.filter(f => f.key !== key);
    setAppliedFilters(updated);
  }, [appliedFilters]);

  const applyAdvancedFilters = () => {
    const newFilters: Array<{ key: string; value: string }> = [];
    if (entityTypeFilter.length > 0) {
      newFilters.push({ key: 'modules', value: entityTypeFilter.join(', ') });
    }
    if (dateRangeFilter !== 'all') {
      newFilters.push({ key: 'dateRange', value: dateRangeFilter });
    }
    if (statusFilterAdvanced !== 'all') {
      newFilters.push({ key: 'status', value: statusFilterAdvanced });
    }
    if (priorityFilter !== 'all') {
      newFilters.push({ key: 'priority', value: priorityFilter });
    }
    setAppliedFilters(newFilters);
    toast.success('Filters applied');
  };

  const searchAnalyticsData: SearchAnalyticsEntry[] = [
    { date: '21 Apr', count: 12 },
    { date: '22 Apr', count: 19 },
    { date: '23 Apr', count: 8 },
    { date: '24 Apr', count: 24 },
    { date: '25 Apr', count: 16 },
    { date: '26 Apr', count: 31 },
    { date: '27 Apr', count: 14 },
  ];

  const topSearchTerms: SearchTerm[] = [
    { term: 'Acme Project', count: 28, category: 'Projects' },
    { term: 'Invoice INV-001', count: 19, category: 'Invoices' },
    { term: 'John Smith', count: 15, category: 'Contacts' },
    { term: 'Electrical Safety', count: 12, category: 'Documents' },
    { term: 'RFI-42', count: 11, category: 'RFIs' },
  ];

  const shellClass = embedded
    ? 'relative w-full z-auto'
    : 'fixed inset-0 bg-black/50 flex items-start justify-center pt-16 z-50';
  const panelClass = embedded
    ? 'bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl mx-auto shadow-2xl min-h-[min(70vh,720px)] max-h-[calc(100dvh-10rem)] flex flex-col'
    : 'bg-gray-900 border border-gray-700 rounded-xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col';

  return (
    <>
      <ModuleBreadcrumbs currentModule="search" />
      <div className={shellClass} onClick={embedded ? undefined : onClose} role={embedded ? undefined : 'presentation'}>
        <div
          className={panelClass}
          data-allow-chrome-shortcuts
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800">
            {embedded && (
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-sm font-semibold text-gray-300">Global search</h2>
                {onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
                    aria-label="Close search"
                  >
                    <X className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            )}
            <div className="flex items-center gap-3">
              {loading ? (
                <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />
              ) : (
                <Search className="h-5 w-5 text-gray-500" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search projects, invoices, contacts, RFIs, documents, AI..."
                className="flex-1 bg-transparent text-white text-lg outline-none placeholder-gray-500"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} className="text-gray-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            {searchMode === 'hybrid' && (
              <div className="mt-2 flex items-center gap-2 text-xs text-cyan-400">
                <Sparkles className="h-3 w-3" />
                AI semantic search active — showing ranked contextual results
              </div>
            )}
            <div className="mt-3 flex gap-2 text-xs text-gray-500">
              <kbd className="px-2 py-1 bg-gray-800 rounded">Ctrl+Shift+K</kbd>
              <span className="text-gray-600">/</span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">⌘⇧K</kbd>
              <span>to open global search from anywhere</span>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="border-b border-gray-800 flex gap-1 px-4 bg-gray-900/50 overflow-x-auto">
            {[
              { key: 'search' as SubTab, label: 'Search' },
              { key: 'recent' as SubTab, label: 'Recent' },
              { key: 'saved' as SubTab, label: 'Saved' },
              { key: 'bookmarks' as SubTab, label: 'Bookmarks' },
              { key: 'advanced' as SubTab, label: 'Filters' },
              { key: 'analytics' as SubTab, label: 'Analytics' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setSubTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
                  subTab === tab.key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Search Tab */}
            {subTab === 'search' && (
              <>
                {appliedFilters.length > 0 && (
                  <div className="p-3 bg-gray-800/30 border-b border-gray-800">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-400">Applied filters:</span>
                      {appliedFilters.map(filter => (
                        <div
                          key={filter.key}
                          className="flex items-center gap-2 px-2 py-1 bg-blue-900/30 border border-blue-700 rounded-full text-xs text-blue-300"
                        >
                          {filter.value}
                          <button
                            onClick={() => removeFilter(filter.key)}
                            className="hover:text-blue-200"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!results && history.length > 0 && (
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <History className="h-4 w-4" />
                        Recent searches
                      </div>
                      <button type="button" onClick={clearHistory} className="text-xs text-gray-500 hover:text-white">
                        Clear
                      </button>
                    </div>
                    <div className="space-y-1">
                      {history.slice(0, 5).map((h, i) => (
                        <button
                          key={i}
                          onClick={() => setQuery(String(h.query))}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 text-sm flex items-center gap-3"
                        >
                          <History className="h-4 w-4 text-gray-600" />
                          {String(h.query)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!results && query.length < 2 && (
                  <div className="p-8 text-center">
                    <Search className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-400 mb-4">Start typing to search across all modules</p>
                    <p className="text-xs text-gray-600">
                      Popular: "Acme Project" • "Invoice #INV-001" • "John Smith" • "RFI-42" • "Site Plan"
                    </p>
                  </div>
                )}

                {results && totalCount === 0 && (
                  <EmptyState
                    icon={Search}
                    title={`No results found for "${String(query)}"`}
                    description="Try a different search term or check your filters."
                    className="py-12"
                  />
                )}

                {/* Semantic / AI Results */}
                {semanticResults.length > 0 && (
                  <div className="p-4 border-b border-gray-800 bg-gray-800/30">
                    <div className="flex items-center gap-2 mb-3 text-xs text-cyan-400 uppercase font-medium">
                      <Brain className="h-4 w-4" />
                      AI Semantic Results (RAG)
                    </div>
                    <div className="space-y-2">
                      {semanticResults.slice(0, 8).map((match, i) => {
                        const Icon = resultIcons[match.table] || Search;
                        return (
                          <button
                            key={`${match.table}-${match.row_id}-${i}`}
                            onClick={() => { handleSearch(); onClose?.(); }}
                            className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2">
                                <Icon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-gray-300 line-clamp-2">{match.chunk_text}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {resultLabels[match.table] || match.table}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-cyan-400 flex-shrink-0">
                                {Math.round(match.score * 100)}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {results &&
                  Object.entries(results).map(([type, items]) => {
                    if (!Array.isArray(items) || items.length === 0) return null;
                    const Icon = resultIcons[type] || Search;
                    return (
                      <div key={type} className="p-4 border-b border-gray-800 last:border-0">
                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 uppercase">
                          <Icon className="h-4 w-4" />
                          {resultLabels[type] || type} ({Number(items.length)})
                        </div>
                        <div className="space-y-1">
                          {items.slice(0, 5).map((item: unknown, i: number) => {
                            const typedItem = item as AnyRow;
                            const itemId = String(typedItem.id || i);
                            const itemTitle = String(
                              typedItem.name || typedItem.number || typedItem.title || typedItem.subject || ''
                            );
                            const isBookmarked = bookmarkedResults.some(b => b.id === `${type}-${itemTitle}`);
                            return (
                              <button
                                key={itemId}
                                onClick={() => {
                                  handleSearch();
                                  onClose?.();
                                }}
                                className={clsx(
                                  'w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between',
                                  'hover:bg-gray-800 text-gray-300'
                                )}
                              >
                                <div>
                                  <p className="font-medium text-white">{itemTitle}</p>
                                  <p className="text-xs opacity-70">
                                    {typedItem.client ? String(typedItem.client) : ''}
                                    {typedItem.company ? String(typedItem.company) : ''}
                                    {typedItem.role ? ` • ${String(typedItem.role)}` : ''}
                                    {typedItem.project ? ` • ${String(typedItem.project)}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      toggleBookmark(itemTitle, type, String(typedItem.project || ''));
                                    }}
                                    className="p-1 rounded hover:bg-gray-700"
                                  >
                                    <Star
                                      className={`h-4 w-4 ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-gray-500'}`}
                                    />
                                  </button>
                                  <ArrowRight className="h-4 w-4 text-gray-600" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

            {/* Recent Tab */}
            {subTab === 'recent' && (
              <div className="p-4 space-y-2">
                {history.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No recent searches</p>
                ) : (
                  history.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => setQuery(String(h.query))}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-800 text-gray-300 text-sm flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <History className="h-4 w-4 text-gray-600" />
                        {String(h.query)}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(Number(h.timestamp)).toLocaleDateString('en-GB')}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Saved Searches Tab */}
            {subTab === 'saved' && (
              <div className="p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(true)}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Save Current Search
                </button>
                {savedSearches.length === 0 ? (
                  <p className="text-center text-gray-400 py-8">No saved searches yet</p>
                ) : (
                  <div className="space-y-2">
                    {savedSearches.map(s => (
                      <div
                        key={s.id}
                        className="bg-gray-800/50 rounded-lg p-3 flex items-center justify-between hover:bg-gray-800 transition-colors group"
                      >
                        <div className="flex-1 cursor-pointer" onClick={() => loadSavedSearch(s)}>
                          <p className="text-sm font-medium text-white">{String(s.name)}</p>
                          <p className="text-xs text-gray-400">
                            {String(s.resultCount)} results • {s.createdDate}
                          </p>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => loadSavedSearch(s)}
                            className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded"
                            title="Load search"
                          >
                            <ArrowRight size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSavedSearch(s.id)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
                            title="Delete search"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bookmarks Tab */}
            {subTab === 'bookmarks' && (
              <div className="p-4">
                {bookmarkedResults.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title="No bookmarked results"
                    description="Star results from search to save them here for quick access"
                    className="py-12"
                  />
                ) : (
                  <div className="space-y-2">
                    {bookmarkedResults.map(bookmark => {
                      const Icon = resultIcons[bookmark.type] || FileText;
                      return (
                        <div
                          key={bookmark.id}
                          className="p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-start gap-3 flex-1">
                            <Icon className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">{bookmark.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {resultLabels[bookmark.type] || bookmark.type}
                                {bookmark.project ? ` • ${bookmark.project}` : ''}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Bookmarked {bookmark.bookmarkedDate}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              toggleBookmark(bookmark.title, bookmark.type, bookmark.project)
                            }
                            className="p-2 rounded hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          >
                            <X className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Advanced Filters Tab */}
            {subTab === 'advanced' && (
              <div className="p-4 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">Modules</label>
                  <div className="space-y-2">
                    {['Projects', 'RFIs', 'Invoices', 'Documents', 'Contacts', 'Tasks'].map(type => (
                      <label key={type} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={entityTypeFilter.includes(type)}
                          onChange={e => {
                            if (e.target.checked) {
                              setEntityTypeFilter(prev => [...prev, type]);
                            } else {
                              setEntityTypeFilter(prev => prev.filter(t => t !== type));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-orange-600 focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-300">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
                  <select
                    value={dateRangeFilter}
                    onChange={e => setDateRangeFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="quarter">This Quarter</option>
                    <option value="year">This Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
                  <select
                    value={statusFilterAdvanced}
                    onChange={e => setStatusFilterAdvanced(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                    <option value="draft">Draft</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={e => setPriorityFilter(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="all">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={applyAdvancedFilters}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg font-medium text-sm hover:bg-orange-700 flex items-center justify-center gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Apply Filters
                </button>
              </div>
            )}

            {/* Analytics Tab */}
            {subTab === 'analytics' && (
              <div className="p-4 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">Searches per Day (Last 30 Days)</span>
                  </div>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={searchAnalyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        labelStyle={{ color: '#F3F4F6' }}
                      />
                      <Bar dataKey="count" fill="#F97316" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">Top Search Terms</span>
                  </div>
                  <div className="space-y-2">
                    {topSearchTerms.map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => setQuery(search.term)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm text-gray-300">{search.term}</p>
                          <p className="text-xs text-gray-500">{search.category}</p>
                        </div>
                        <span className="text-xs font-semibold text-orange-400">{search.count} searches</span>
                      </button>
                    ))}
                  </div>
                </div>

                {zeroResultSearches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 text-sm text-gray-400">
                      <AlertCircle className="h-4 w-4" />
                      <span className="font-medium">Zero-Result Searches</span>
                    </div>
                    <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 space-y-2">
                      {zeroResultSearches.slice(0, 5).map((term, idx) => (
                        <div key={idx} className="text-xs text-amber-300">
                          "{term}"
                        </div>
                      ))}
                      <p className="text-xs text-amber-400 mt-2">
                        Consider indexing more content or refining search terms
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-gray-800 bg-gray-900/50 p-3 flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">↑↓</kbd> Navigate
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Enter</kbd> Select
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd> Close
              </span>
            </div>
            {results && <span className="text-blue-400">{Number(allResults.length)} results</span>}
          </div>
        </div>

        {showSaveModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700">
              <div className="flex items-center justify-between p-6 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-white">Save Search</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveSearchName('');
                  }}
                  className="p-2 hover:bg-gray-700 rounded-lg text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Search Name</label>
                  <input
                    type="text"
                    value={saveSearchName}
                    onChange={e => setSaveSearchName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveCurrentSearch();
                    }}
                    placeholder="e.g., 'Active Projects This Month'"
                    className="w-full border border-gray-600 bg-gray-900 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    autoFocus
                  />
                </div>
                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Search query:</p>
                  <p className="text-sm text-gray-300 truncate">{query}</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveModal(false);
                      setSaveSearchName('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveCurrentSearch}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                    disabled={!saveSearchName.trim()}
                  >
                    Save Search
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default GlobalSearch;
