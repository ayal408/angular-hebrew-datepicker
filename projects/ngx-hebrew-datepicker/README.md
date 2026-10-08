# ngx-hebrew-datepicker

בורר תאריך עברי ל-Angular — מקביל ל-[react-hebrew-datepicker](https://github.com/Es-Mes/react-hebrew-datepicker).
A Hebrew-calendar date picker for Angular: RTL by default, gematria dates (כ״ח בתשרי תשפ״ז), optional Gregorian
display, and an ISO value (`YYYY-MM-DD`) so it drops into any existing date field.

- No calendar dependency: conversion uses the browser's own ICU Hebrew calendar (`Intl`, `he-u-ca-hebrew`),
  including leap years (Adar I / Adar II).
- Works with `ngModel`, reactive forms (`ControlValueAccessor`) or `[(value)]`.
- Opens below or above the field depending on available space; the popup is `position: fixed`, so it isn't clipped
  by `overflow: hidden` parents.
- Keyboard: arrows move by day/week, Enter selects, Escape closes.
- Themed entirely through CSS variables.

## Usage

```ts
import { HebrewDatepickerComponent } from 'ngx-hebrew-datepicker';

@Component({
  imports: [FormsModule, HebrewDatepickerComponent],
  template: `<hebrew-datepicker name="date" [(ngModel)]="date" label="בחרו תאריך עברי" [showGregorian]="true" />`,
})
export class MyComponent { date = ''; }
```

```html
<!-- bounded birth date -->
<hebrew-datepicker name="birthDate" [(ngModel)]="birthDate" minDate="1940-01-01" [maxDate]="todayIso" [showGregorian]="true" />

<!-- external label, not clearable -->
<label for="endDate">תאריך סיום</label>
<hebrew-datepicker id="endDate" name="endDate" [label]="null" [allowClear]="false" [(ngModel)]="endDate" />

<!-- reactive form, no Saturdays -->
<hebrew-datepicker [formControl]="meeting" [required]="true" [isDateDisabled]="noShabbat" />
```

## Inputs and outputs

| Name | Type | Default | Purpose |
| --- | --- | --- | --- |
| `name` | `string` | `''` | Name of the hidden input carrying the ISO value |
| `id` | `string` | auto | Field id, so an external `<label for>` focuses it |
| `label` | `string \| null` | `'תאריך'` | Built-in label; `null` hides it |
| `value` | `string` (model) | `''` | ISO date, two-way: `[(value)]` |
| `allowClear` | `boolean` | `true` | `false` hides the clear buttons |
| `required` | `boolean` | `false` | Marks the label with `*` |
| `disabled` | `boolean` | `false` | Locks the field (forms' `disable()` works too) |
| `labels` | `Partial<HebrewDatepickerLabels>` | Hebrew | Placeholder, today, clear, navigation, Gregorian month names |
| `minDate` / `maxDate` | ISO `string` | none | Inclusive bounds; also limit the year list |
| `isDateDisabled` | `(iso) => boolean` | none | Blocks individual days |
| `showGregorian` | `boolean` | `false` | Gregorian day numbers + a Gregorian month bar |
| `dir` | `'rtl' \| 'ltr'` | `'rtl'` | Text direction |
| `popupClass` | `string` | `''` | Extra class on the calendar popup |
| `inline` | `boolean` | `false` | Always-visible calendar instead of a field with a popup |
| `markedDates` | `Record<string, string>` | `{}` | Days to highlight (ISO date → tooltip), e.g. holidays or closures |
| `(dateChange)` | `string` | — | Fires on every user change (`''` when cleared) |

Without `minDate`/`maxDate` the year list spans 30 years either side of the shown year.

Helpers are exported too: `fromIso`, `toIso`, `hebrewParts`, `gematria`, `formatHebrew`, `formatGregorian`.

## Theming

Override the variables on the element or any ancestor:

```css
.dark hebrew-datepicker {
  --hdp-primary: #f3b32e;   --hdp-on-primary: #243747; --hdp-accent: #f3b32e;
  --hdp-surface: #213243;   --hdp-surface-soft: #2a3c50;
  --hdp-text: #f6f7fc;      --hdp-muted: #c5cadb;      --hdp-border: #4a5c75;
  --hdp-gregorian: #c5cadb; --hdp-mark: #f58a66;    --hdp-radius: 12px;        --hdp-shadow: 0 14px 34px rgba(0,0,0,.45);
  --hdp-font: inherit;
}
```

## Development

```bash
npm install
npx ng serve demo                          # demo page
npx ng test ngx-hebrew-datepicker --watch=false
npx ng build ngx-hebrew-datepicker         # -> dist/ngx-hebrew-datepicker
```

Requires Angular 22.

## License

MIT
