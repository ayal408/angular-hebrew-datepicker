import {
  ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, forwardRef, input, model, output, signal, viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  addDays, daysOfHebrewMonth, formatGregorian, formatHebrew, fromIso, gematria, hebrewParts, monthsOfHebrewYear,
  nextHebrewMonth, prevHebrewMonth, sameMonthInYear, startOfHebrewMonth, toIso, today,
} from './hebrew-date';

export interface HebrewDatepickerLabels {
  placeholder: string;
  today: string;
  clear: string;
  prevMonth: string;
  nextMonth: string;
  openCalendar: string;
  /** Gregorian month names, January first. */
  gregorianMonths: string[];
}

export const DEFAULT_HEBREW_DATEPICKER_LABELS: HebrewDatepickerLabels = {
  placeholder: 'בחרו תאריך',
  today: 'היום',
  clear: 'ניקוי',
  prevMonth: 'החודש הקודם',
  nextMonth: 'החודש הבא',
  openCalendar: 'פתיחת לוח שנה',
  gregorianMonths: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
};

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const POPUP_WIDTH = 300;
const POPUP_GAP = 6;

interface DayCell { iso: string; hebrew: string; gregorian: number; disabled: boolean; isToday: boolean; selected: boolean; }

/**
 * Hebrew-calendar date picker - an Angular counterpart of
 * react-hebrew-datepicker. The value is always an ISO date (YYYY-MM-DD),
 * so it drops into existing date fields unchanged. Works with ngModel,
 * reactive forms, or [(value)].
 */
@Component({
  selector: 'hebrew-datepicker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => HebrewDatepickerComponent), multi: true }],
  template: `
    <div class="hdp" [attr.dir]="dir()">
      @if (label() !== null) {
        <label class="hdp-label" [attr.for]="fieldId()">{{ label() }}@if (required()) {<span class="hdp-required"> *</span>}</label>
      }
      <div class="hdp-field" [class.hdp-field--open]="open()" [class.hdp-field--disabled]="isDisabled()">
        <button #trigger type="button" class="hdp-trigger" [id]="fieldId()" [disabled]="isDisabled()"
                aria-haspopup="dialog" [attr.aria-expanded]="open()" [attr.aria-label]="label() || labelsResolved().openCalendar"
                (click)="toggle()">
          <svg class="hdp-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 8h14v10H5V10z"/></svg>
          @if (selectedDate(); as date) {
            <span class="hdp-text">{{ hebrewText(date) }}</span>
            @if (showGregorian()) { <span class="hdp-greg-text">{{ gregorianText(date) }}</span> }
          } @else {
            <span class="hdp-placeholder">{{ labelsResolved().placeholder }}</span>
          }
        </button>
        @if (allowClear() && value() && !isDisabled()) {
          <button type="button" class="hdp-clear" [attr.aria-label]="labelsResolved().clear" (click)="clear()">×</button>
        }
      </div>
      <input type="hidden" [attr.name]="name()" [value]="value() || ''" />

      @if (open()) {
        <div #popup class="hdp-popup {{ popupClass() }}" role="dialog" [attr.dir]="dir()"
             [style.top.px]="popupPos().top" [style.left.px]="popupPos().left" [style.max-height.px]="popupPos().maxHeight"
             (keydown)="onPopupKey($event)">
          <div class="hdp-head">
            <button type="button" class="hdp-nav" [disabled]="!canPrev()" [attr.aria-label]="labelsResolved().prevMonth" (click)="shiftMonth(-1)">‹</button>
            <select class="hdp-select" aria-label="חודש" (change)="pickMonth($any($event.target).value)">
              @for (m of yearMonths(); track m.getTime(); let i = $index) { <option [value]="i" [selected]="i === viewMonthIndex()">{{ monthName(m) }}</option> }
            </select>
            <select class="hdp-select" aria-label="שנה" (change)="pickYear(+$any($event.target).value)">
              @for (y of yearOptions(); track y) { <option [value]="y" [selected]="y === viewYear()">{{ yearName(y) }}</option> }
            </select>
            <button type="button" class="hdp-nav" [disabled]="!canNext()" [attr.aria-label]="labelsResolved().nextMonth" (click)="shiftMonth(1)">›</button>
          </div>
          @if (showGregorian()) { <div class="hdp-greg-bar">{{ gregorianRange() }}</div> }
          <div class="hdp-grid" role="grid">
            @for (w of weekdays; track w) { <div class="hdp-weekday" role="columnheader">{{ w }}</div> }
            @for (b of leadingBlanks(); track $index) { <div></div> }
            @for (cell of cells(); track cell.iso) {
              <button type="button" class="hdp-day" role="gridcell" [attr.data-iso]="cell.iso"
                      [class.hdp-day--today]="cell.isToday" [class.hdp-day--selected]="cell.selected"
                      [disabled]="cell.disabled" [attr.aria-selected]="cell.selected"
                      [attr.tabindex]="cell.iso === focusIso() ? 0 : -1"
                      [attr.aria-label]="cell.hebrew + (showGregorian() ? ' · ' + cell.gregorian : '')"
                      (click)="select(cell.iso)">
                <span class="hdp-day-heb">{{ cell.hebrew }}</span>
                @if (showGregorian()) { <span class="hdp-day-greg">{{ cell.gregorian }}</span> }
              </button>
            }
          </div>
          <div class="hdp-foot">
            <button type="button" class="hdp-link" [disabled]="isBlocked(todayIso)" (click)="select(todayIso)">{{ labelsResolved().today }}</button>
            @if (allowClear() && value()) {
              <button type="button" class="hdp-link" (click)="clear()">{{ labelsResolved().clear }}</button>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --hdp-primary: #314b5b;
      --hdp-on-primary: #ffffff;
      --hdp-accent: #efa91f;
      --hdp-surface: #ffffff;
      --hdp-surface-soft: #f0f1f8;
      --hdp-text: #314b5b;
      --hdp-muted: #6a788c;
      --hdp-border: #d7dce9;
      --hdp-gregorian: #6a788c;
      --hdp-radius: 12px;
      --hdp-shadow: 0 14px 34px rgba(49, 75, 91, .18);
      --hdp-font: inherit;
      font-family: var(--hdp-font);
    }
    .hdp { position: relative; color: var(--hdp-text); }
    .hdp-label { display: block; margin-block-end: .35rem; font-weight: 650; font-size: .9rem; }
    .hdp-required { color: var(--hdp-accent); }
    .hdp-field {
      display: flex; align-items: center; min-height: 44px;
      background: var(--hdp-surface); border: 1px solid var(--hdp-border); border-radius: var(--hdp-radius);
      transition: border-color .15s, box-shadow .15s;
    }
    .hdp-field:hover { border-color: var(--hdp-muted); }
    .hdp-field--open, .hdp-field:focus-within { border-color: var(--hdp-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--hdp-accent) 22%, transparent); }
    .hdp-field--disabled { opacity: .55; }
    .hdp-trigger {
      flex: 1; display: flex; align-items: center; gap: .55rem; min-width: 0;
      padding: .55rem .8rem; border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer;
    }
    .hdp-trigger:disabled { cursor: not-allowed; }
    .hdp-trigger:focus-visible { outline: none; }
    .hdp-icon { flex: none; width: 18px; height: 18px; fill: var(--hdp-muted); }
    .hdp-text { font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hdp-greg-text { color: var(--hdp-gregorian); font-size: .85rem; white-space: nowrap; }
    .hdp-placeholder { color: var(--hdp-muted); }
    .hdp-clear {
      flex: none; width: 32px; height: 32px; margin-inline-end: .3rem; border: 0; border-radius: 50%;
      background: none; color: var(--hdp-muted); font-size: 1.25rem; line-height: 1; cursor: pointer;
    }
    .hdp-clear:hover { background: var(--hdp-surface-soft); color: var(--hdp-text); }

    .hdp-popup {
      position: fixed; z-index: 1100; width: ${POPUP_WIDTH}px; box-sizing: border-box; overflow-y: auto;
      padding: .75rem; color: var(--hdp-text); background: var(--hdp-surface);
      border: 1px solid var(--hdp-border); border-radius: var(--hdp-radius); box-shadow: var(--hdp-shadow);
    }
    .hdp-head { display: flex; align-items: center; gap: .35rem; }
    .hdp-nav {
      flex: none; width: 32px; height: 32px; border: 1px solid var(--hdp-border); border-radius: 8px;
      background: var(--hdp-surface); color: var(--hdp-text); font-size: 1.2rem; line-height: 1; cursor: pointer;
    }
    [dir='rtl'] .hdp-nav { transform: scaleX(-1); }
    .hdp-nav:hover:not(:disabled) { border-color: var(--hdp-accent); }
    .hdp-nav:disabled { opacity: .35; cursor: default; }
    .hdp-select {
      flex: 1; min-width: 0; height: 32px; padding: 0 .4rem; border: 1px solid var(--hdp-border) !important;
      border-radius: 8px; background: var(--hdp-surface) !important; color: var(--hdp-text) !important; font: inherit; font-weight: 650;
    }
    .hdp-greg-bar {
      margin-top: .5rem; padding: .25rem .5rem; border-radius: 8px; text-align: center; font-size: .8rem;
      color: var(--hdp-gregorian); background: var(--hdp-surface-soft);
    }
    .hdp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; margin-top: .55rem; }
    .hdp-weekday { padding-block: .2rem; text-align: center; font-size: .75rem; font-weight: 700; color: var(--hdp-muted); }
    .hdp-day {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px;
      aspect-ratio: 1; min-height: 34px; padding: 0; border: 1px solid transparent; border-radius: 9px;
      background: none; color: var(--hdp-text); font: inherit; cursor: pointer;
    }
    .hdp-day-heb { font-weight: 650; font-size: .9rem; line-height: 1; }
    .hdp-day-greg { font-size: .62rem; line-height: 1; color: var(--hdp-gregorian); }
    .hdp-day:hover:not(:disabled) { background: var(--hdp-surface-soft); }
    .hdp-day:focus-visible { outline: 2px solid var(--hdp-accent); outline-offset: 1px; }
    .hdp-day--today { border-color: var(--hdp-accent); }
    .hdp-day--selected, .hdp-day--selected:hover:not(:disabled) { background: var(--hdp-primary); color: var(--hdp-on-primary); }
    .hdp-day--selected .hdp-day-greg { color: inherit; opacity: .8; }
    .hdp-day:disabled { opacity: .3; cursor: not-allowed; }
    .hdp-foot { display: flex; justify-content: space-between; margin-top: .55rem; padding-top: .5rem; border-top: 1px solid var(--hdp-border); }
    .hdp-link {
      padding: .3rem .6rem; border: 0; border-radius: 8px; background: none;
      color: var(--hdp-text); font: inherit; font-weight: 700; cursor: pointer;
    }
    .hdp-link:hover:not(:disabled) { background: var(--hdp-surface-soft); }
    .hdp-link:disabled { opacity: .4; cursor: default; }
  `],
})
export class HebrewDatepickerComponent implements ControlValueAccessor {
  private static nextId = 0;

  /** Name of the hidden input carrying the ISO value (native form posts). */
  readonly name = input<string>('');
  /** Id for the field, so an external <label for> can focus it. */
  readonly id = input<string>('');
  /** Built-in label text; null hides it. */
  readonly label = input<string | null>('תאריך');
  readonly allowClear = input(true);
  readonly required = input(false);
  readonly disabled = input(false);
  readonly labels = input<Partial<HebrewDatepickerLabels>>({});
  /** Inclusive bounds, ISO; they also limit the year list. */
  readonly minDate = input<string | null>(null);
  readonly maxDate = input<string | null>(null);
  readonly isDateDisabled = input<((iso: string) => boolean) | null>(null);
  /** Gregorian day numbers in the grid and a Gregorian month bar. */
  readonly showGregorian = input(false);
  readonly dir = input<'rtl' | 'ltr'>('rtl');
  readonly popupClass = input('');

  /** The ISO date; '' when empty. Two-way bindable: [(value)]. */
  readonly value = model<string>('');
  /** Fires on every user change with the new ISO date ('' when cleared). */
  readonly dateChange = output<string>();

  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly popup = viewChild<ElementRef<HTMLElement>>('popup');

  readonly weekdays = WEEKDAYS;
  readonly todayIso = toIso(today());
  readonly open = signal(false);
  readonly viewStart = signal<Date>(startOfHebrewMonth(today()));
  readonly focusIso = signal('');
  readonly popupPos = signal({ top: 0, left: 0, maxHeight: 420 });
  private readonly formDisabled = signal(false);
  private readonly autoId = `hebrew-datepicker-${HebrewDatepickerComponent.nextId++}`;

  readonly fieldId = computed(() => this.id() || this.autoId);
  readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  readonly labelsResolved = computed(() => ({ ...DEFAULT_HEBREW_DATEPICKER_LABELS, ...this.labels() }));
  readonly selectedDate = computed(() => fromIso(this.value()));
  private readonly min = computed(() => fromIso(this.minDate()));
  private readonly max = computed(() => fromIso(this.maxDate()));

  readonly monthDays = computed(() => daysOfHebrewMonth(this.viewStart()));
  readonly leadingBlanks = computed(() => Array(this.viewStart().getUTCDay()));
  readonly cells = computed<DayCell[]>(() => this.monthDays().map((d) => {
    const iso = toIso(d);
    return {
      iso,
      hebrew: gematria(hebrewParts(d).day),
      gregorian: d.getUTCDate(),
      disabled: this.isBlocked(iso),
      isToday: iso === this.todayIso,
      selected: iso === this.value(),
    };
  }));
  readonly viewYear = computed(() => hebrewParts(this.viewStart()).year);
  readonly yearMonths = computed(() => monthsOfHebrewYear(this.viewStart()));
  readonly viewMonthIndex = computed(() => this.yearMonths().findIndex((m) => m.getTime() === this.viewStart().getTime()));
  readonly yearOptions = computed(() => {
    const view = this.viewYear();
    const from = this.min() ? hebrewParts(this.min()!).year : view - 30;
    const to = this.max() ? hebrewParts(this.max()!).year : view + 30;
    const years: number[] = [];
    for (let y = Math.min(from, view); y <= Math.max(to, view); y++) years.push(y);
    return years;
  });
  readonly canPrev = computed(() => !this.min() || this.viewStart() > this.min()!);
  readonly canNext = computed(() => {
    const days = this.monthDays();
    return !this.max() || days[days.length - 1] < this.max()!;
  });
  readonly gregorianRange = computed(() => {
    const days = this.monthDays();
    const first = days[0], last = days[days.length - 1];
    const names = this.labelsResolved().gregorianMonths;
    const a = names[first.getUTCMonth()], b = names[last.getUTCMonth()];
    if (first.getUTCFullYear() !== last.getUTCFullYear()) return `${a} ${first.getUTCFullYear()} – ${b} ${last.getUTCFullYear()}`;
    return a === b ? `${a} ${first.getUTCFullYear()}` : `${a} – ${b} ${first.getUTCFullYear()}`;
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef<HTMLElement>) {}

  hebrewText = formatHebrew;
  gregorianText = formatGregorian;
  monthName(monthStart: Date) { return hebrewParts(monthStart).month; }
  yearName(year: number) { return gematria(year); }

  isBlocked(iso: string): boolean {
    const date = fromIso(iso)!;
    if (this.min() && date < this.min()!) return true;
    if (this.max() && date > this.max()!) return true;
    return !!this.isDateDisabled()?.(iso);
  }

  toggle() { this.open() ? this.close() : this.openPopup(); }

  openPopup() {
    if (this.isDisabled()) return;
    const anchor = this.selectedDate() ?? today();
    this.viewStart.set(startOfHebrewMonth(anchor));
    this.focusIso.set(toIso(anchor));
    this.position();
    this.open.set(true);
    setTimeout(() => this.focusDay());
  }

  close(returnFocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    this.onTouched();
    if (returnFocus) this.trigger()?.nativeElement.focus();
  }

  select(iso: string) {
    if (this.isBlocked(iso)) return;
    this.setValue(iso);
    this.close(true);
  }

  clear() {
    this.setValue('');
    this.close(true);
  }

  shiftMonth(step: 1 | -1) {
    this.viewStart.set(step > 0 ? nextHebrewMonth(this.viewStart()) : prevHebrewMonth(this.viewStart()));
    this.focusIso.set(toIso(this.viewStart()));
  }

  pickMonth(index: string) {
    const month = this.yearMonths()[+index];
    if (month) { this.viewStart.set(month); this.focusIso.set(toIso(month)); }
  }

  pickYear(year: number) {
    const month = sameMonthInYear(this.viewStart(), year);
    this.viewStart.set(month);
    this.focusIso.set(toIso(month));
  }

  onPopupKey(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); this.close(true); return; }
    const target = event.target as HTMLElement;
    if (!target.classList.contains('hdp-day')) return;
    const rtl = this.dir() === 'rtl';
    const deltas: Record<string, number> = {
      ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -7, ArrowDown: 7,
    };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = addDays(fromIso(this.focusIso())!, delta);
    this.viewStart.set(startOfHebrewMonth(next));
    this.focusIso.set(toIso(next));
    setTimeout(() => this.focusDay());
  }

  private focusDay() {
    const popup = this.popup()?.nativeElement;
    const day = popup?.querySelector<HTMLElement>(`[data-iso="${this.focusIso()}"]`)
      ?? popup?.querySelector<HTMLElement>('.hdp-day:not(:disabled)');
    day?.focus();
  }

  private setValue(iso: string) {
    this.value.set(iso);
    this.onChange(iso);
    this.dateChange.emit(iso);
  }

  /** Opens below the field, or above it when there's more room there. */
  private position() {
    const field = this.host.nativeElement.querySelector('.hdp-field')?.getBoundingClientRect();
    if (!field) return;
    const below = window.innerHeight - field.bottom - POPUP_GAP * 2;
    const above = field.top - POPUP_GAP * 2;
    const wanted = 420;
    const openAbove = below < wanted && above > below;
    const maxHeight = Math.max(220, Math.min(wanted, openAbove ? above : below));
    const top = openAbove ? Math.max(POPUP_GAP, field.top - POPUP_GAP - maxHeight) : field.bottom + POPUP_GAP;
    const rtl = this.dir() === 'rtl';
    let left = rtl ? field.right - POPUP_WIDTH : field.left;
    left = Math.min(Math.max(POPUP_GAP, left), window.innerWidth - POPUP_WIDTH - POPUP_GAP);
    this.popupPos.set({ top, left, maxHeight });
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(event: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange() { if (this.open()) this.position(); }

  writeValue(value: string | null): void { this.value.set(value ?? ''); }
  registerOnChange(fn: (value: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.formDisabled.set(isDisabled); }
}
