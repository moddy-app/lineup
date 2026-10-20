import {apiFetch} from '../client';
import type {CreateReportBody, CreateReportResponse} from '../types';

/**
 * `POST /lineup/reports`: 201 `{created: true}`, or 200 `{created: false}` when
 * this person already has an open report on the target ("already reported").
 * 10 per hour per person.
 */
export function createReport(body: CreateReportBody): Promise<CreateReportResponse> {
  return apiFetch<CreateReportResponse>('/lineup/reports', {method: 'POST', body});
}
