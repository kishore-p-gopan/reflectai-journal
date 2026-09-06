import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { 
  X, 
  MapPin, 
  Compass, 
  Calendar, 
  Search, 
  LocateFixed, 
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Navigation,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2,
  RotateCcw
} from 'lucide-react';
import { ReflectionEntry } from '../types';

interface JournalMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ReflectionEntry[];
  activeEntryId?: string | null;
  onSelectEntry: (entry: ReflectionEntry) => void;
  onUpdateEntryLocation?: (entryId: string, geo: { lat: number; lng: number }) => Promise<void> | void;
}

interface PickedLocation {
  lat: number;
  lng: number;
  address?: string;
}

export const JournalMapModal: React.FC<JournalMapModalProps> = ({
  isOpen,
  onClose,
  entries,
  activeEntryId,
  onSelectEntry,
  onUpdateEntryLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const pickedMarkerRef = useRef<any>(null);
  const entryMarkersRef = useRef<Map<string, any>>(new Map());

  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(activeEntryId || null);
  
  // Search & custom picked location state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null);
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  // Filter & tab controls for entries list
  const [filterTab, setFilterTab] = useState<'geotagged' | 'all'>('geotagged');
  const [entryKeyword, setEntryKeyword] = useState('');
  const [mobileTab, setMobileTab] = useState<'map' | 'list'>('map');

  // Interactive Resizing & Responsive Scaling state
  const [customDimensions, setCustomDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDraggingCorner, setIsDraggingCorner] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialW: number; initialH: number } | null>(null);

  // Filter entries with valid geotags
  const geotaggedEntries = useMemo(() => {
    return entries.filter(
      (e) => e.geo && typeof e.geo.lat === 'number' && typeof e.geo.lng === 'number'
    );
  }, [entries]);

  // Displayed entries based on tab & keyword
  const displayedEntries = useMemo(() => {
    const pool = filterTab === 'geotagged' ? geotaggedEntries : entries;
    if (!entryKeyword.trim()) return pool;
    const lower = entryKeyword.toLowerCase();
    return pool.filter(
      (e) =>
        e.title.toLowerCase().includes(lower) ||
        (e.summary && e.summary.toLowerCase().includes(lower)) ||
        (e.primaryPrompt && e.primaryPrompt.toLowerCase().includes(lower)) ||
        e.tags?.some((t) => t.toLowerCase().includes(lower))
    );
  }, [entries, geotaggedEntries, filterTab, entryKeyword]);

  const activeSelectedEntry = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) || null;
  }, [entries, selectedEntryId]);

  // Synchronize activeEntryId when changed from parent
  useEffect(() => {
    if (activeEntryId && !selectedEntryId) {
      setSelectedEntryId(activeEntryId);
    }
  }, [activeEntryId]);

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      setMapError('Google Maps JavaScript API key (VITE_GOOGLE_MAPS_API_KEY) is optional and currently not configured in .env.');
      return;
    }

    let isMounted = true;
    setMapError(null);

    setOptions({
      key: apiKey,
      v: 'weekly',
      solutionChannel: 'gmp_mcp_codeassist_v1_aistudio',
    });

    Promise.all([
      importLibrary('maps'),
      importLibrary('marker'),
    ])
      .then(async ([{ Map }, { AdvancedMarkerElement }]: any) => {
        if (!isMounted || !mapContainerRef.current) return;

        // Determine initial center: selected entry, or first geotagged entry, or default
        let initialCenter = { lat: 37.7749, lng: -122.4194 };
        if (activeSelectedEntry?.geo) {
          initialCenter = { lat: activeSelectedEntry.geo.lat, lng: activeSelectedEntry.geo.lng };
        } else if (geotaggedEntries.length > 0 && geotaggedEntries[0].geo) {
          initialCenter = { lat: geotaggedEntries[0].geo.lat, lng: geotaggedEntries[0].geo.lng };
        }

        const map = new Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: geotaggedEntries.length > 0 ? 12 : 5,
          mapId: 'DEMO_MAP_ID',
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });

        mapInstanceRef.current = map;

        // Clean up previous markers
        entryMarkersRef.current.forEach((marker) => {
          if (marker && marker.map) marker.map = null;
        });
        entryMarkersRef.current.clear();

        const bounds = new google.maps.LatLngBounds();
        const infoWindow = new google.maps.InfoWindow();

        // Render markers for all geotagged entries
        geotaggedEntries.forEach((entry) => {
          if (!entry.geo) return;
          const position = { lat: entry.geo.lat, lng: entry.geo.lng };
          bounds.extend(position);

          const marker = new AdvancedMarkerElement({
            position,
            map,
            title: entry.title,
          });

          marker.addListener('gmp-click', () => {
            setSelectedEntryId(entry.id);
            setPickedLocation({
              lat: entry.geo!.lat,
              lng: entry.geo!.lng,
              address: entry.title,
            });

            const contentString = `
              <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 6px; max-width: 240px;">
                <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #0f172a;">${entry.title}</h4>
                <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b; line-height: 1.4;">${entry.summary || entry.primaryPrompt?.slice(0, 80) || 'Reflected here'}</p>
                <div style="font-size: 10px; color: #4f46e5; font-weight: 600;">Location: ${entry.geo?.lat.toFixed(4)}°, ${entry.geo?.lng.toFixed(4)}°</div>
              </div>
            `;
            infoWindow.setContent(contentString);
            infoWindow.open({
              anchor: marker,
              map,
            });
          });

          entryMarkersRef.current.set(entry.id, marker);
        });

        if (geotaggedEntries.length > 1) {
          map.fitBounds(bounds);
        }

        // Map Click Listener to pick or refine location
        map.addListener('click', async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return;
          const lat = Number(e.latLng.lat().toFixed(4));
          const lng = Number(e.latLng.lng().toFixed(4));

          setPickedLocation({ lat, lng });
          setSearchFeedback(`Selected point (${lat}°, ${lng}°)`);

          // Reverse geocode to get formatted address
          reverseGeocodeCoordinate(lat, lng).then((address) => {
            if (address && isMounted) {
              setPickedLocation((prev) => (prev ? { ...prev, address } : null));
              setSearchFeedback(`Selected: ${address}`);
            }
          });

          // Place / Update the picked target pin on the map
          if (pickedMarkerRef.current) {
            pickedMarkerRef.current.position = e.latLng;
            pickedMarkerRef.current.map = map;
          } else {
            // Create a custom styled pin for the picked location
            const pinContent = document.createElement('div');
            pinContent.className = 'w-6 h-6 rounded-full bg-indigo-600 border-2 border-white shadow-lg flex items-center justify-center text-white';
            pinContent.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;

            pickedMarkerRef.current = new AdvancedMarkerElement({
              position: e.latLng,
              map,
              title: 'Picked Target Location',
              content: pinContent,
            });
          }
        });

        // ResizeObserver to ensure tiles render seamlessly in dynamic modals
        if (mapContainerRef.current) {
          const resizeObserver = new ResizeObserver(() => {
            if (mapInstanceRef.current) {
              google.maps.event.trigger(mapInstanceRef.current, 'resize');
            }
          });
          resizeObserver.observe(mapContainerRef.current);
        }

        setIsMapLoaded(true);
      })
      .catch((err) => {
        console.warn('Google Maps loading exception:', err);
        if (isMounted) {
          setMapError('Failed to load Google Maps script. You can still inspect and manage reflections in the list.');
        }
      });

    return () => {
      isMounted = false;
      if (pickedMarkerRef.current) {
        pickedMarkerRef.current.map = null;
        pickedMarkerRef.current = null;
      }
    };
  }, [isOpen, geotaggedEntries.length]);

  // Trigger Google Maps resize when window dimension changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          google.maps.event.trigger(mapInstanceRef.current, 'resize');
        }
      }, 50);
    }
  }, [customDimensions, isMaximized]);

  // Corner Drag Resizing Logic
  const handleResizePointerDown = (e: React.PointerEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();

    const container = modalContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialW: rect.width,
      initialH: rect.height,
    };

    setIsDraggingCorner(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const deltaY = moveEvent.clientY - dragStartRef.current.startY;

      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Ensure dimensions stay within bounds
      const minW = Math.min(500, viewportW - 32);
      const maxW = viewportW - 24;
      const minH = Math.min(420, viewportH - 32);
      const maxH = viewportH - 24;

      const newW = Math.max(minW, Math.min(maxW, dragStartRef.current.initialW + deltaX));
      const newH = Math.max(minH, Math.min(maxH, dragStartRef.current.initialH + deltaY));

      setCustomDimensions({ width: Math.round(newW), height: Math.round(newH) });
    };

    const handlePointerUp = () => {
      setIsDraggingCorner(false);
      dragStartRef.current = null;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Resilient zero-billing reverse geocoder (via same-origin backend proxy)
  const reverseGeocodeCoordinate = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const resp = await fetch(`/api/geo/reverse?lat=${lat}&lng=${lng}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.address) {
          return data.address;
        }
      }
    } catch {
      // Graceful fallback (coordinates will be displayed cleanly)
    }
    return `${lat}°, ${lng}°`;
  };

  // Resilient zero-billing forward geocoder (via same-origin backend proxy)
  const forwardGeocodeSearch = async (query: string): Promise<{ lat: number; lng: number; address: string } | null> => {
    const clean = query.trim();
    if (!clean) return null;

    try {
      const resp = await fetch(`/api/geo/search?q=${encodeURIComponent(clean)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data?.results && data.results.length > 0) {
          const top = data.results[0];
          return {
            lat: top.lat,
            lng: top.lng,
            address: top.address || top.displayName,
          };
        }
      }
    } catch (err) {
      console.warn('Location search error:', err);
    }

    return null;
  };

  // Handle Location Search
  const handleSearchLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchFeedback(null);

    try {
      const result = await forwardGeocodeSearch(searchQuery);
      if (result) {
        const { lat, lng, address } = result;

        setPickedLocation({ lat, lng, address });
        setSearchFeedback(`Found: ${address}`);

        // Center and zoom map smoothly if map is available
        if (mapInstanceRef.current) {
          const location = { lat, lng };
          mapInstanceRef.current.panTo(location);
          mapInstanceRef.current.setZoom(14);

          // Place custom marker
          try {
            const { AdvancedMarkerElement } = (await importLibrary('marker')) as any;
            if (pickedMarkerRef.current) {
              pickedMarkerRef.current.position = location;
              pickedMarkerRef.current.map = mapInstanceRef.current;
            } else {
              const pinContent = document.createElement('div');
              pinContent.className = 'w-7 h-7 rounded-full bg-indigo-600 border-2 border-white shadow-xl flex items-center justify-center text-white';
              pinContent.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="currentColor"/></svg>`;

              pickedMarkerRef.current = new AdvancedMarkerElement({
                position: location,
                map: mapInstanceRef.current,
                title: address,
                content: pinContent,
              });
            }
          } catch {
            // Marker placement gracefully handled
          }
        }
      } else {
        setSearchFeedback('No matching location found. You can enter coordinates (e.g., 37.77, -122.41) or a city name.');
      }
    } catch (err: any) {
      console.warn('Location search issue:', err);
      setSearchFeedback('Search failed. Try entering coordinates (e.g., 37.77, -122.41).');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle GPS / Current Browser Location
  const handleUseCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setSearchFeedback('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingUser(true);
    setSearchFeedback('Acquiring current GPS location...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setIsLocatingUser(false);
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        const latLng = { lat, lng };

        setPickedLocation({ lat, lng, address: 'Current Location' });
        setSearchFeedback(`Located: (${lat}°, ${lng}°)`);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(latLng);
          mapInstanceRef.current.setZoom(15);
        }

        // Reverse geocode in background with fallback
        reverseGeocodeCoordinate(lat, lng).then((address) => {
          if (address) {
            setPickedLocation({ lat, lng, address });
            setSearchFeedback(`Located: ${address}`);
          }
        });
      },
      (err) => {
        setIsLocatingUser(false);
        setSearchFeedback('Unable to retrieve location. Permission denied or GPS timeout.');
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  // Center map on a specific entry
  const handleFocusEntryOnMap = (entry: ReflectionEntry) => {
    setSelectedEntryId(entry.id);
    if (!entry.geo) return;

    const latLng = { lat: entry.geo.lat, lng: entry.geo.lng };
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(latLng);
      mapInstanceRef.current.setZoom(14);
    }

    setPickedLocation({
      lat: entry.geo.lat,
      lng: entry.geo.lng,
      address: entry.title,
    });
  };

  // Save the picked location to the target reflection
  const handleApplyLocationToEntry = async (entryId: string) => {
    if (!pickedLocation || !onUpdateEntryLocation) return;
    setIsSavingLocation(true);

    try {
      await onUpdateEntryLocation(entryId, {
        lat: pickedLocation.lat,
        lng: pickedLocation.lng,
      });
      setSearchFeedback(`Location successfully attached to reflection!`);
    } catch (e) {
      console.error('Failed applying location:', e);
      setSearchFeedback('Failed to update reflection location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  if (!isOpen) return null;

  // Compute inline styles based on responsive percentage bounds or custom drag dimensions
  const modalStyle: React.CSSProperties = isMaximized
    ? {
        width: 'calc(100vw - 20px)',
        height: 'calc(100vh - 20px)',
        maxWidth: '100%',
        maxHeight: '100%',
      }
    : customDimensions
    ? {
        width: `${customDimensions.width}px`,
        height: `${customDimensions.height}px`,
        maxWidth: 'calc(100vw - 20px)',
        maxHeight: 'calc(100vh - 20px)',
      }
    : {
        width: 'min(92vw, 1180px)',
        height: 'min(88vh, 840px)',
        minHeight: '480px',
      };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-hidden select-none">
      <div 
        ref={modalContainerRef}
        style={modalStyle}
        className={`bg-white border border-slate-200/90 rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900 relative transition-[width,height] ${
          isDraggingCorner ? 'transition-none select-none' : ''
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200/90 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-xs">
              <MapPin className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-slate-900 font-serif tracking-tight">
                  Reflections Map &amp; Location Finder
                </h3>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/80">
                  {geotaggedEntries.length} of {entries.length} Geotagged
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Search addresses, click the map to refine points, and drag the bottom-right corner to resize
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Mobile View Toggle */}
            <div className="flex sm:hidden rounded-lg bg-slate-100 p-0.5 text-xs">
              <button
                onClick={() => setMobileTab('map')}
                className={`px-2 py-1 rounded-md font-medium transition ${
                  mobileTab === 'map' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                }`}
              >
                Map
              </button>
              <button
                onClick={() => setMobileTab('list')}
                className={`px-2 py-1 rounded-md font-medium transition ${
                  mobileTab === 'list' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                }`}
              >
                List ({displayedEntries.length})
              </button>
            </div>

            {/* Reset Size button if customized */}
            {customDimensions && !isMaximized && (
              <button
                onClick={() => setCustomDimensions(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                title="Reset window size"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Maximize / Restore Toggle */}
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer hidden sm:block"
              title={isMaximized ? "Restore standard size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
              title="Close Map View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Location Search & Accuracy Controls Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <form onSubmit={handleSearchLocation} className="flex items-center gap-2 flex-1 min-w-[260px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search city, landmark, or address (e.g., Central Park, Tokyo, 37.77, -122.41)..."
                className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search Place</span>
            </button>

            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocatingUser}
              className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg text-xs font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Pinpoint current GPS location"
            >
              {isLocatingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <LocateFixed className="w-3.5 h-3.5 text-emerald-600" />}
              <span className="hidden md:inline">Current GPS</span>
            </button>
          </form>

          {/* Quick Tip / Drag notice */}
          <div className="text-[11px] text-slate-500 hidden xl:flex items-center gap-1.5 shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Click anywhere on the map to pinpoint &bull; Drag bottom-right corner to resize</span>
          </div>
        </div>

        {/* Feedback / Active Selection Notice */}
        {searchFeedback && (
          <div className="px-5 py-1.5 bg-indigo-50/70 border-b border-indigo-100/80 text-xs text-indigo-900 flex items-center justify-between shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 truncate">
              <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-medium truncate">{searchFeedback}</span>
            </div>
            <button
              onClick={() => setSearchFeedback(null)}
              className="text-indigo-400 hover:text-indigo-700 text-xs shrink-0 ml-2 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Content Layout: Map + Entries Side-by-Side */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Left Column: Interactive Map Canvas */}
          <div className={`flex-1 h-full relative flex flex-col min-h-0 bg-slate-100 ${
            mobileTab === 'list' ? 'hidden md:flex' : 'flex'
          }`}>
            {mapError ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-50">
                <div className="w-11 h-11 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="text-sm font-semibold text-slate-800">Map Preview Standby</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {mapError}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Configure <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[10px] font-mono text-slate-700">VITE_GOOGLE_MAPS_API_KEY</code> to enable the satellite/street map view. You can use a free, zero-billing{' '}
                    <a
                      href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-700 underline font-medium inline-flex items-center gap-0.5"
                    >
                      Maps Demo Key
                      <ExternalLink className="w-2.5 h-2.5 inline" />
                    </a>{' '}
                    for instant prototyping.
                  </p>
                  <p className="text-[11px] text-slate-400 pt-1">
                    All your geotagged and recent reflections remain fully accessible in the side panel.
                  </p>
                </div>
              </div>
            ) : (
              <div 
                ref={mapContainerRef} 
                className="w-full h-full min-h-[280px] outline-none" 
              />
            )}

            {/* Floating Banner when a location is picked/searched on the map */}
            {pickedLocation && (
              <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto z-10 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-xl max-w-md flex flex-col gap-2 animate-in slide-in-from-bottom-3 duration-200">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 leading-tight">
                        {pickedLocation.address || 'Selected Map Point'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                        {pickedLocation.lat.toFixed(4)}°, {pickedLocation.lng.toFixed(4)}°
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setPickedLocation(null);
                      if (pickedMarkerRef.current) pickedMarkerRef.current.map = null;
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear point"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Action button: Apply to active/selected reflection */}
                {activeSelectedEntry ? (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => handleApplyLocationToEntry(activeSelectedEntry.id)}
                      disabled={isSavingLocation}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-medium transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      {isSavingLocation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Set as location for "{activeSelectedEntry.title}"</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    Select a reflection from the right panel to attach this location.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Reflections Directory & Location Manager */}
          <div className={`w-full md:w-80 lg:w-96 flex flex-col min-h-0 border-l border-slate-200/90 bg-slate-50/50 ${
            mobileTab === 'map' ? 'hidden md:flex' : 'flex'
          }`}>
            
            {/* Filter Tabs Header */}
            <div className="p-3 bg-white border-b border-slate-200/80 space-y-2.5 shrink-0">
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  onClick={() => setFilterTab('geotagged')}
                  className={`flex-1 py-1.5 rounded-md transition text-center ${
                    filterTab === 'geotagged'
                      ? 'bg-white shadow-xs text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Geotagged ({geotaggedEntries.length})
                </button>
                <button
                  onClick={() => setFilterTab('all')}
                  className={`flex-1 py-1.5 rounded-md transition text-center ${
                    filterTab === 'all'
                      ? 'bg-white shadow-xs text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Entries ({entries.length})
                </button>
              </div>

              {/* Keyword Filter for Reflections */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={entryKeyword}
                  onChange={(e) => setEntryKeyword(e.target.value)}
                  placeholder="Filter reflections by title or topic..."
                  className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500"
                />
                {entryKeyword && (
                  <button
                    onClick={() => setEntryKeyword('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Entry List with Visible Scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
              {displayedEntries.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-2">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No reflections match</p>
                  <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">
                    {filterTab === 'geotagged'
                      ? 'No reflections with coordinates found. Switch to "All Entries" to attach a location.'
                      : 'No reflections found for this search filter.'}
                  </p>
                  {filterTab === 'geotagged' && entries.length > 0 && (
                    <button
                      onClick={() => setFilterTab('all')}
                      className="text-xs font-medium text-indigo-600 hover:underline pt-1 cursor-pointer"
                    >
                      View all {entries.length} reflections
                    </button>
                  )}
                </div>
              ) : (
                displayedEntries.map((entry) => {
                  const isSelected = selectedEntryId === entry.id;
                  const hasGeo = entry.geo && typeof entry.geo.lat === 'number' && typeof entry.geo.lng === 'number';

                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setSelectedEntryId(entry.id);
                        if (hasGeo) handleFocusEntryOnMap(entry);
                      }}
                      className={`p-3 rounded-xl border transition cursor-pointer text-left space-y-2 relative group ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                          : 'bg-white hover:bg-slate-50/80 border-slate-200/80 hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <h4 className="text-xs font-semibold text-slate-900 leading-snug line-clamp-1">
                          {entry.title}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {entry.summary || entry.primaryPrompt || 'Untitled reflection entry.'}
                      </p>

                      {/* Location Badge & Status */}
                      <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-100 text-[10px]">
                        {hasGeo ? (
                          <span className="font-mono text-emerald-600 font-medium inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {entry.geo?.lat.toFixed(2)}°, {entry.geo?.lng.toFixed(2)}°
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No location attached</span>
                        )}

                        <div className="flex items-center gap-1.5 opacity-90">
                          {pickedLocation && isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleApplyLocationToEntry(entry.id);
                              }}
                              disabled={isSavingLocation}
                              className="px-2 py-0.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-medium transition cursor-pointer"
                              title="Assign searched location to this reflection"
                            >
                              Apply Pin
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEntry(entry);
                              onClose();
                            }}
                            className="text-slate-400 hover:text-indigo-600 p-0.5 transition cursor-pointer"
                            title="Open reflection in Studio"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Status Help */}
            <div className="p-2.5 bg-white border-t border-slate-200/80 text-[11px] text-slate-400 flex items-center justify-between shrink-0">
              <span>{displayedEntries.length} reflection{displayedEntries.length === 1 ? '' : 's'} listed</span>
              <span>Click card to center map</span>
            </div>
          </div>
        </div>

        {/* Footer Guidance Bar with Resize Grip Corner */}
        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200/80 bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-500 gap-2 shrink-0 relative">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">Search, click map, or assign coordinates to entries</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[10px] hidden md:inline">
              Google Maps Platform &bull; Maps JavaScript &amp; Geocoding
            </span>

            {/* Bottom-right interactive resize handle */}
            {!isMaximized && (
              <div
                onPointerDown={handleResizePointerDown}
                title="Click and drag to resize window"
                className="w-5 h-5 flex items-center justify-center cursor-nwse-resize text-slate-400 hover:text-slate-700 transition active:text-indigo-600 -mr-1.5 touch-none"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <circle cx="8" cy="2" r="1.2" />
                  <circle cx="8" cy="5" r="1.2" />
                  <circle cx="5" cy="5" r="1.2" />
                  <circle cx="8" cy="8" r="1.2" />
                  <circle cx="5" cy="8" r="1.2" />
                  <circle cx="2" cy="8" r="1.2" />
                </svg>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
