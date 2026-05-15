'use client';
import { useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { ThumbnailCanvas } from './ThumbnailCanvas';
import { Search } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

export function Gallery() {
  const loadedFiles = useAppStore((state) => state.loadedFiles);
  const setSelectedClass = useAppStore((state) => state.setSelectedClass);
  const theme = useAppStore((state) => state.theme);

  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);
  const diskFilter = useAppStore((state) => state.diskFilter);
  const setDiskFilter = useAppStore((state) => state.setDiskFilter);
  const contactFilter = useAppStore((state) => state.contactFilter);
  const setContactFilter = useAppStore((state) => state.setContactFilter);
  const dofFilter = useAppStore((state) => state.dofFilter);
  const setDofFilter = useAppStore((state) => state.setDofFilter);
  const sortBy = useAppStore((state) => state.sortBy);
  const setSortBy = useAppStore((state) => state.setSortBy);
  const resetFilters = useAppStore((state) => state.resetFilters);

  const hasActiveFilters = searchQuery !== '' || diskFilter !== 'all' || contactFilter !== 'all' || dofFilter !== 'all' || sortBy !== 'disks-asc';

  const allClasses = useMemo(() => {
    return loadedFiles.flatMap(f => f.contactClasses);
  }, [loadedFiles]);

  const uniqueDisks = useMemo(() => {
    const set = new Set(allClasses.map(c => c.disksCount));
    return Array.from(set).sort((a, b) => a - b);
  }, [allClasses]);

  const uniqueContacts = useMemo(() => {
    const set = new Set(allClasses.map(c => c.contacts.length));
    return Array.from(set).sort((a, b) => a - b);
  }, [allClasses]);

  const uniqueDof = useMemo(() => {
    const set = new Set(allClasses.map(c => c.dof));
    return Array.from(set).sort((a, b) => a - b);
  }, [allClasses]);

  const diskOptions = useMemo(() => [
    { value: 'all', label: 'All Disks' },
    ...uniqueDisks.map(d => ({ value: String(d), label: `${d} Disks` }))
  ], [uniqueDisks]);

  const contactOptions = useMemo(() => [
    { value: 'all', label: 'All Contacts' },
    ...uniqueContacts.map(c => ({ value: String(c), label: `${c} Contacts` }))
  ], [uniqueContacts]);

  const dofOptions = useMemo(() => [
    { value: 'all', label: 'All DoF' },
    ...uniqueDof.map(d => ({ value: String(d), label: `DoF ${d}` }))
  ], [uniqueDof]);

  const sortOptions = useMemo(() => [
    { value: 'disks-asc', label: 'Sort: Disks (Low to High)' },
    { value: 'disks-desc', label: 'Sort: Disks (High to Low)' },
    { value: 'contacts-asc', label: 'Sort: Contacts (Low to High)' },
    { value: 'contacts-desc', label: 'Sort: Contacts (High to Low)' },
    { value: 'dof-asc', label: 'Sort: DoF (Low to High)' },
    { value: 'dof-desc', label: 'Sort: DoF (High to Low)' }
  ], []);

  const filteredAndSortedClasses = useMemo(() => {
    let result = [...allClasses];

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.id.toLowerCase().includes(q) || 
        c.fileName.toLowerCase().includes(q)
      );
    }

    if (diskFilter !== 'all') {
      const val = Number(diskFilter);
      result = result.filter(c => c.disksCount === val);
    }

    if (contactFilter !== 'all') {
      const val = Number(contactFilter);
      result = result.filter(c => c.contacts.length === val);
    }

    if (dofFilter !== 'all') {
      const val = Number(dofFilter);
      result = result.filter(c => c.dof === val);
    }

    const compareIds = (idA: string | undefined | null, idB: string | undefined | null): number => {
      const valA = idA || '';
      const valB = idB || '';
      const partsA = valA.split('_');
      const partsB = valB.split('_');
      const numA = partsA.length > 1 ? Number(partsA[1]) : 0;
      const numB = partsB.length > 1 ? Number(partsB[1]) : 0;
      if (isNaN(numA) || isNaN(numB)) {
        return valA.localeCompare(valB);
      }
      return numA - numB;
    };

    result.sort((a, b) => {
      if (sortBy === 'disks-asc') return a.disksCount - b.disksCount || compareIds(a.id, b.id);
      if (sortBy === 'disks-desc') return b.disksCount - a.disksCount || compareIds(a.id, b.id);
      if (sortBy === 'contacts-asc') return a.contacts.length - b.contacts.length || compareIds(a.id, b.id);
      if (sortBy === 'contacts-desc') return b.contacts.length - a.contacts.length || compareIds(a.id, b.id);
      if (sortBy === 'dof-asc') return a.dof - b.dof || compareIds(a.id, b.id);
      if (sortBy === 'dof-desc') return b.dof - a.dof || compareIds(a.id, b.id);
      return 0;
    });

    return result;
  }, [allClasses, searchQuery, diskFilter, contactFilter, dofFilter, sortBy]);

  if (loadedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-8">
        <p>No contact classes loaded.</p>
      </div>
    );
  }

  return (
    <div className={`p-8 h-full overflow-y-auto flex flex-col gap-6 custom-scrollbar transition-colors duration-200 ${
      theme === 'light' ? 'bg-zinc-50' : 'bg-zinc-900'
    }`}>
      <div className={`flex flex-col md:flex-row justify-between md:items-center gap-4 border-b pb-5 transition-colors duration-200 ${
        theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
      }`}>
        <div>
          <h2 className={`text-2xl font-bold tracking-wide transition-colors duration-200 ${
            theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'
          }`}>Contact Classes</h2>
          <p className={`text-xs mt-1 transition-colors duration-200 ${
            theme === 'light' ? 'text-zinc-500' : 'text-zinc-500'
          }`}>Showing {filteredAndSortedClasses.length} out of {allClasses.length}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-48">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 transition-colors duration-200 ${
              theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'
            }`} />
            <input 
              type="text"
              placeholder="Search by ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-8 pr-3 py-2 border rounded-lg outline-none text-xs transition-all duration-200 shadow-md font-medium ${
                theme === 'light'
                  ? 'bg-white border-zinc-200 text-zinc-800 placeholder-zinc-400 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:border-zinc-500'
              }`}
            />
          </div>

          <CustomSelect 
            value={diskFilter}
            onChange={setDiskFilter}
            options={diskOptions}
          />

          <CustomSelect 
            value={contactFilter}
            onChange={setContactFilter}
            options={contactOptions}
          />

          <CustomSelect 
            value={dofFilter}
            onChange={setDofFilter}
            options={dofOptions}
          />

          <CustomSelect 
            value={sortBy}
            onChange={setSortBy}
            options={sortOptions}
          />

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all duration-200 shadow-md cursor-pointer flex items-center justify-center ${
                theme === 'light'
                  ? 'bg-white hover:bg-zinc-50 text-red-600 hover:text-red-500 border-zinc-200 hover:border-zinc-300'
                  : 'bg-zinc-900 text-red-400 hover:text-red-300 border-zinc-700 hover:border-zinc-500'
              }`}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {filteredAndSortedClasses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAndSortedClasses.map((cls, idx) => (
            <div 
              key={`${cls.fileName}-${cls.id}-${idx}`}
              className={`group rounded-xl border overflow-hidden transition-all duration-200 cursor-pointer flex flex-col shadow-sm ${
                theme === 'light'
                  ? 'bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-md'
                  : 'bg-zinc-800 border-zinc-700 hover:border-zinc-500/80'
              }`}
              onClick={() => setSelectedClass(cls)}
            >
              <div className={`p-4 border-b flex justify-center transition-colors duration-200 ${
                theme === 'light' ? 'bg-zinc-50/50 border-zinc-200' : 'bg-zinc-900/50 border-zinc-700/50'
              }`}>
                <ThumbnailCanvas 
                  centers={cls.centers} 
                  contacts={cls.contacts} 
                  width={220} 
                  height={160} 
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className={`font-bold text-lg truncate mb-4 transition-colors duration-200 ${
                  theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'
                }`} title={cls.id}>
                  {cls.id}
                </h3>

                <div className={`text-sm space-y-1 mt-auto transition-colors duration-200 ${
                  theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'
                }`}>
                  <div className="flex justify-between">
                    <span>Disks:</span>
                    <span className={`font-mono font-semibold transition-colors duration-200 ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>{cls.disksCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contacts:</span>
                    <span className={`font-mono font-semibold transition-colors duration-200 ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>{cls.contacts.length}</span>
                  </div>
                  <div className={`flex justify-between pt-2 border-t mt-2 transition-colors duration-200 ${
                    theme === 'light' ? 'border-zinc-200' : 'border-zinc-700/50'
                  }`}>
                    <span>DoF:</span>
                    <span className={`font-mono font-semibold transition-colors duration-200 ${
                      theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'
                    }`}>{cls.dof}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`flex flex-col items-center justify-center py-16 border border-dashed rounded-2xl transition-colors duration-200 ${
          theme === 'light'
            ? 'text-zinc-400 border-zinc-300 bg-white shadow-sm'
            : 'text-zinc-500 border-zinc-800 bg-zinc-900/20'
        }`}>
          <p className="text-sm">No contact classes match your search and filter criteria.</p>
          <button 
            onClick={resetFilters}
            className={`mt-4 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-200 cursor-pointer ${
              theme === 'light'
                ? 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200 shadow-sm'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
            }`}
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}
