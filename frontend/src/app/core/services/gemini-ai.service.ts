import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';
import { DashboardStats } from '../models/usage.model';
import { environment } from '../../../environments/environment';

export interface AiInsightResult {
  summary: string;
  securityRecommendation: string;
  trafficAssessment: string;
  statusLevel: 'OPTIMAL' | 'ATTENTION' | 'CRITICAL';
}

export interface ScopeRecommendation {
  recommendedScopes: string[];
  recommendedRateLimit: number;
  reasoning: string;
}

@Injectable({ providedIn: 'root' })
export class GeminiAiService {
  private readonly http = inject(HttpClient);

  private readonly apiKey = (environment as any).geminiApiKey || '';
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  generateDashboardInsights(stats: DashboardStats): Observable<AiInsightResult> {
    if (!this.apiKey) {
      return of(this.getFallbackInsights(stats));
    }

    const promptText = `
You are an expert DevSecOps and API Gateway Analyst for KeyForge platform.
Analyze these real-time API metrics:
- Total API Calls Today: ${stats.totalApiCallsToday}
- Active API Keys: ${stats.activeKeyCount}
- Error Rate: ${stats.errorRatePercent}%
- Total Projects: ${stats.totalProjects}

Provide a concise json evaluation with 4 fields:
1. "summary": 1-2 sentence executive summary.
2. "securityRecommendation": 1 actionable security recommendation.
3. "trafficAssessment": 1 sentence traffic & rate limit assessment.
4. "statusLevel": "OPTIMAL" if errorRate < 2%, "ATTENTION" if errorRate between 2-5%, "CRITICAL" if errorRate > 5%.

Return ONLY valid JSON.
`;

    const body = {
      contents: [{ parts: [{ text: promptText }] }],
    };

    return this.http.post<any>(`${this.apiUrl}?key=${this.apiKey}`, body).pipe(
      map((res) => {
        try {
          const rawText = res.candidates[0].content.parts[0].text;
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return {
            summary: parsed.summary || 'Platform API traffic is functioning normally.',
            securityRecommendation: parsed.securityRecommendation || 'Ensure all production keys have rate limits and 24h grace period rotation enabled.',
            trafficAssessment: parsed.trafficAssessment || 'Call volume is steady within expected thresholds.',
            statusLevel: parsed.statusLevel || (stats.errorRatePercent > 2 ? 'ATTENTION' : 'OPTIMAL'),
          };
        } catch {
          return this.getFallbackInsights(stats);
        }
      }),
      catchError(() => of(this.getFallbackInsights(stats)))
    );
  }

  recommendScopesForKey(keyName: string): Observable<ScopeRecommendation> {
    if (!keyName || keyName.trim().length === 0) {
      return of({
        recommendedScopes: ['READ_USERS'],
        recommendedRateLimit: 60,
        reasoning: 'Default principle of least privilege applied.',
      });
    }

    const promptText = `
A developer is creating an API Key named "${keyName}" on KeyForge API Gateway.
Available Scopes: READ_USERS, WRITE_USERS, READ_PROJECTS, WRITE_PROJECTS, READ_BILLING, WRITE_BILLING, READ_ANALYTICS, ADMIN_ALL.

Select the minimum necessary scopes (least privilege principle) and a recommended per-minute rate limit.
Return JSON ONLY with:
"recommendedScopes": array of scope strings,
"recommendedRateLimit": number (e.g. 30, 60, 120, 300),
"reasoning": 1 short sentence explanation.
`;

    if (!this.apiKey) {
      return of(this.getFallbackScopeRecommendation(keyName));
    }

    const body = { contents: [{ parts: [{ text: promptText }] }] };

    return this.http.post<any>(`${this.apiUrl}?key=${this.apiKey}`, body).pipe(
      map((res) => {
        try {
          const rawText = res.candidates[0].content.parts[0].text;
          const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return {
            recommendedScopes: parsed.recommendedScopes || ['READ_USERS'],
            recommendedRateLimit: parsed.recommendedRateLimit || 60,
            reasoning: parsed.reasoning || 'Scope recommendation based on least privilege security principle.',
          };
        } catch {
          return this.getFallbackScopeRecommendation(keyName);
        }
      }),
      catchError(() => of(this.getFallbackScopeRecommendation(keyName)))
    );
  }

  private getFallbackScopeRecommendation(keyName: string): ScopeRecommendation {
    const lower = keyName.toLowerCase();

    if (lower.includes('billing') || lower.includes('payment') || lower.includes('stripe')) {
      return {
        recommendedScopes: ['READ_BILLING', 'WRITE_BILLING'],
        recommendedRateLimit: 30,
        reasoning: 'Billing integration detected. Granted billing scopes with strict rate limit.',
      };
    }
    if (lower.includes('mobile') || lower.includes('client') || lower.includes('public')) {
      return {
        recommendedScopes: ['READ_USERS', 'READ_PROJECTS'],
        recommendedRateLimit: 120,
        reasoning: 'Public/Client key detected. Granted read-only scopes with standard quota.',
      };
    }
    if (lower.includes('admin') || lower.includes('master') || lower.includes('root')) {
      return {
        recommendedScopes: ['ADMIN_ALL'],
        recommendedRateLimit: 300,
        reasoning: 'Administrative key detected. Granted full admin access.',
      };
    }

    return {
      recommendedScopes: ['READ_USERS', 'READ_ANALYTICS'],
      recommendedRateLimit: 60,
      reasoning: 'Standard application service key detected with least-privilege read access.',
    };
  }

  private getFallbackInsights(stats: DashboardStats): AiInsightResult {
    const isHighError = stats.errorRatePercent > 5;
    const isMediumError = stats.errorRatePercent > 2;

    return {
      summary: isHighError
        ? `Elevated error rate detected (${stats.errorRatePercent}%). Immediate security & gateway inspection recommended.`
        : `Platform operating at peak performance with ${stats.totalApiCallsToday} total API calls across ${stats.activeKeyCount} active keys.`,
      securityRecommendation: stats.activeKeyCount > 10
        ? 'High count of active keys detected. Review unrotated legacy keys and enforce 24-hour grace period rotations.'
        : 'Zero-trust SHA-256 storage enabled. All key creation and rotation events are actively audited.',
      trafficAssessment: isMediumError
        ? 'Rate limiting rules are actively throttling unauthorized or failing requests.'
        : 'API call distribution is healthy with optimal backend throughput.',
      statusLevel: isHighError ? 'CRITICAL' : isMediumError ? 'ATTENTION' : 'OPTIMAL',
    };
  }
}
