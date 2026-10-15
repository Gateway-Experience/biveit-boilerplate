import { useState, useCallback, useRef, useEffect } from 'react';
import _ from 'lodash';
import { debounce } from 'lodash';
import { v4 } from 'uuid';
import { SearchIcon } from 'lucide-react';

import { FieldShell } from 'src/components/common/FormField';
import { Input } from 'src/components/shadui/input';
import { Spinner } from 'src/components/shadui/spinner';

export type Item = { id: string | number; label: string; [key: string]: unknown };

type LastRequest = {
  id: string;
  input: string;
  pending: boolean;
  querying: boolean;
  suggestions?: Item[] | null;
};

export type AutoSuggestionProps = {
  debounceMs?: number;
  noResultsText?: string;
  onSearch: (input: string) => Promise<Item[]>;
  clearOnSelect?: boolean;
  value?: Item | null;
  onChange: (item: Item | null) => void;
  renderSuggestion?: (item: Item, onSelect: (item: Item) => void) => React.ReactNode;
  pauseClickAway?: boolean;
  label?: React.ReactNode;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  placeholder?: string;
};

// Based on user input, provide suggestions (asynchronously) for user to choose.
// Use debouncing to avoid excessive suggesting.
export default function AutoSuggestion({
  debounceMs = 200,
  noResultsText = 'No results found',
  onSearch,
  clearOnSelect = false,
  value: selectedItem,
  onChange: setSelectedItem,
  renderSuggestion,
  // Since suggestion providing could be expensive, the component provide an option to disable click away
  // (normally clicking away from the suggestion dropdown closes it).
  pauseClickAway = false,
  label,
  error,
  helperText,
  fullWidth,
  ...props
}: AutoSuggestionProps) {
  const [inputValue, setInputValue] = useState(_.get(selectedItem, 'label', ''));
  const [suggestions, setSuggestions] = useState<Item[] | null>(selectedItem ? [selectedItem] : null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastRequest, setLastRequest] = useState<LastRequest | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const escapeOut = useCallback(() => {
    setShowSuggestions(false);
    if (!selectedItem) {
      setInputValue('');
      setSuggestions(null);
    } else {
      setInputValue(selectedItem.label);
    }
  }, [selectedItem, setInputValue, setSuggestions, setShowSuggestions]);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node) && !pauseClickAway) {
        escapeOut();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [escapeOut, pauseClickAway]);

  useEffect(() => {
    if (!selectedItem) {
      setSuggestions(null);
      setInputValue('');
    } else {
      setSuggestions([selectedItem]);
      setInputValue(selectedItem.label);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!lastRequest) {
      return;
    }
    if (_.has(lastRequest, 'suggestions')) {
      setSuggestions(lastRequest.suggestions ?? null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
  }, [lastRequest, setSuggestions]);

  // eslint-disable-next-line
  const debouncedSearch = useCallback(
    debounce(async (request: LastRequest) => {
      if (!request) {
        return;
      }
      if (request.pending) {
        setLastRequest(newLastRequest => {
          if (newLastRequest && newLastRequest.id === request.id) {
            return {
              ...newLastRequest,
              pending: false,
              querying: true,
            };
          } else {
            return newLastRequest;
          }
        });
        const results = await onSearch(request.input);
        setLastRequest(newLastRequest => {
          if (newLastRequest && newLastRequest.id === request.id) {
            return {
              ...newLastRequest,
              query: false,
              suggestions: results,
            };
          } else {
            return newLastRequest;
          }
        });
      }
    }, debounceMs),
    [setLastRequest, onSearch],
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    setShowSuggestions(true);

    if (value.trim()) {
      const newLastRequest = {
        id: v4(),
        input: value,
        pending: true,
        querying: false,
      };
      setLastRequest(newLastRequest);
      debouncedSearch(newLastRequest);
    } else {
      setLastRequest(
        {
          id: v4(),
          input: value,
          pending: false,
          querying: false,
          suggestions: null,
        },
      );
      setSelectedItem(null);
    }
  }, [setInputValue, setShowSuggestions, setLastRequest, debouncedSearch, setSelectedItem]);

  const handleSelectItem = useCallback((item: Item) => {
    setSelectedItem(item);
    if (clearOnSelect) {
      setInputValue('');
      setSuggestions(null);
    }
    setShowSuggestions(false);
  }, [setSelectedItem, setInputValue, setSuggestions, setShowSuggestions, clearOnSelect]);

  const _renderSuggestion = useCallback((item: Item) => {
    if (!renderSuggestion) {
      return (
        <p
          key={item.id}
          onClick={() => handleSelectItem(item)}
          className='cursor-pointer px-4 py-2 transition-colors hover:bg-muted'
        >
          {item.label}
        </p>
      );
    }
    return renderSuggestion(item, handleSelectItem);
  }, [renderSuggestion, handleSelectItem]);

  return (
    <div className='relative w-full' ref={wrapperRef}>
      <FieldShell label={label} error={error} helperText={helperText} fullWidth={fullWidth}>
        {shellProps => (
          <div className='relative'>
            <Input
              {...props}
              {...shellProps}
              className='pr-9'
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={ev => {
                if (ev.key === 'Escape') {
                  ev.preventDefault();
                  escapeOut();
                }
              }}
              onFocus={() => setShowSuggestions(true)}
            />
            <span className='absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground'>
              {isLoading ? <Spinner className='size-5' /> : <SearchIcon className='size-5' />}
            </span>
          </div>
        )}
      </FieldShell>

      {showSuggestions && suggestions && (
        <div className='absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg'>
          {suggestions.length > 0 ? (
            suggestions.map(s => _renderSuggestion(s))
          ) : (
            <p className='p-4 text-center text-muted-foreground'>
              {noResultsText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
