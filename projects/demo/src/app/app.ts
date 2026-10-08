import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { HebrewDatepickerComponent, formatHebrew, fromIso } from 'ngx-hebrew-datepicker';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ReactiveFormsModule, HebrewDatepickerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly todayIso = new Date().toISOString().slice(0, 10);

  basic = '';
  readonly withGregorian = signal('');
  birthDate = '';
  endDate = '2026-10-09';
  readonly meeting = new FormControl('', Validators.required);
  readonly dark = signal(false);

  /** No Shabbat: Saturday is getUTCDay() 6 on the ISO date. */
  readonly noShabbat = (iso: string) => new Date(iso + 'T12:00:00Z').getUTCDay() === 6;

  hebrew(iso: string | null) {
    const date = fromIso(iso);
    return date ? formatHebrew(date) : '—';
  }
}
