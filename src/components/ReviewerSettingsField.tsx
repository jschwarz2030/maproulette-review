import { useId } from 'react'
import { getHostUi } from '../host'

export const ReviewerSettingsField = ({
  value,
  onChange,
  disabled,
}: {
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) => {
  const { Label, RadioGroup, RadioGroupItem } = getHostUi()
  const yesId = useId()
  const noId = useId()
  const isReviewer = Boolean(value)

  return (
    <div className="space-y-2">
      <Label className="font-medium text-sm">Volunteer as a Reviewer</Label>
      <RadioGroup
        value={isReviewer ? 'yes' : 'no'}
        disabled={disabled}
        onValueChange={(next: string) => onChange(next === 'yes')}
        className="flex gap-6"
      >
        <label htmlFor={yesId} className="flex cursor-pointer items-center gap-2">
          <RadioGroupItem value="yes" id={yesId} />
          <span className="text-sm">Yes</span>
        </label>
        <label htmlFor={noId} className="flex cursor-pointer items-center gap-2">
          <RadioGroupItem value="no" id={noId} />
          <span className="text-sm">No</span>
        </label>
      </RadioGroup>
      <p className="text-xs text-zinc-500 dark:text-slate-400">
        Volunteer to review tasks for which a review has been requested
      </p>
    </div>
  )
}
