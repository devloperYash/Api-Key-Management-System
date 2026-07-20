import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../models/api-key.model';

export interface AuditLogResponse {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly http = inject(HttpClient);

  list(organizationId: string, page = 0, size = 10): Observable<PageResponse<AuditLogResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<AuditLogResponse>>(
      `${environment.apiBaseUrl}/organizations/${organizationId}/audit-logs`,
      { params }
    );
  }
}
