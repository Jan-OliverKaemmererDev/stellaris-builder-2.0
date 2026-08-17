import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '../services/game-math.utils';

/**
 * Angular pipe that formats numbers into compact, human-readable strings.
 * Uses K for thousands, M for millions, B for billions.
 *
 * Usage: `{{ 1230500 | compactNumber }}` → `1.23M`
 */
@Pipe({
  name: 'compactNumber',
  standalone: true,
})
export class CompactNumberPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value == null) return '0';
    return formatNumber(value);
  }
}
