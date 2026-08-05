import { useEffect, useState } from 'react'
import { getHostUi } from '../host'
import {
  canAddMoreErrorTags,
  type ErrorTagOption,
  fetchErrorTagOptions,
  formatErrorTagNames,
} from '../lib/errorTags'

type ErrorTagPickerProps = {
  selectedIds: number[]
  onChange: (ids: number[]) => void
  required?: boolean
}

/**
 * Reviewer error-code picker — select up to 5 tags from the global error keyword catalog.
 */
export const ErrorTagPicker = ({
  selectedIds,
  onChange,
  required = false,
}: ErrorTagPickerProps) => {
  const {
    Badge,
    Button,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } = getHostUi()

  const [options, setOptions] = useState<ErrorTagOption[]>([])
  const [loading, setLoading] = useState(true)
  const [addKey, setAddKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchErrorTagOptions().then((tags) => {
      if (!cancelled) {
        setOptions(tags)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const available = options.filter((option) => !selectedIds.includes(option.id))
  const nameFor = (id: number) => options.find((option) => option.id === id)?.name ?? `#${id}`

  const removeId = (id: number) => {
    onChange(selectedIds.filter((selected) => selected !== id))
  }

  const addId = (value: string) => {
    const id = Number(value)
    if (!Number.isFinite(id) || id <= 0 || selectedIds.includes(id)) return
    onChange([...selectedIds, id])
    setAddKey((key) => key + 1)
  }

  if (loading) {
    return <p className="text-xs text-zinc-500 dark:text-slate-400">Loading error codes…</p>
  }

  if (options.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <Label>
        Error codes
        {required ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
      </Label>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => (
            <Badge key={id} variant="destructive" className="gap-1 pr-1">
              {nameFor(id)}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                aria-label={`Remove ${nameFor(id)}`}
                onClick={() => removeId(id)}
              >
                ×
              </Button>
            </Badge>
          ))}
        </div>
      )}
      {canAddMoreErrorTags(selectedIds, options.length) && available.length > 0 && (
        <Select key={addKey} onValueChange={addId}>
          <SelectTrigger className="w-full" aria-label="Add error code">
            <SelectValue placeholder="Add error code…" />
          </SelectTrigger>
          <SelectContent>
            {available.map((option) => (
              <SelectItem key={option.id} value={String(option.id)}>
                {option.name}
                {option.description ? ` — ${option.description}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {required && selectedIds.length === 0 && (
        <p className="text-xs text-red-600 dark:text-red-400">
          This challenge requires at least one error code.
        </p>
      )}
    </div>
  )
}

/** Resolve CSV error-tag IDs to display names (loads catalog once). */
export const useResolvedErrorTagNames = (errorTags?: string | null): string[] => {
  const [names, setNames] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    if (!errorTags?.trim()) {
      setNames([])
      return
    }
    void fetchErrorTagOptions().then((options) => {
      if (cancelled) return
      setNames(formatErrorTagNames(errorTags, options))
    })
    return () => {
      cancelled = true
    }
  }, [errorTags])

  return names
}
