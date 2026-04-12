import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LLMModel {
  id: number;
  model_id: string;
  display_name: string;
  is_default: boolean;
}

@Injectable({ providedIn: 'root' })
export class LlmModelService {
  private readonly baseUrl = `${environment.apiUrl}/llm-models`;

  constructor(private http: HttpClient) {}

  listActive(): Observable<LLMModel[]> {
    return this.http.get<LLMModel[]>(`${this.baseUrl}/`);
  }

  getOrgDefault(): Observable<{ default_llm_model: LLMModel | null }> {
    return this.http.get<{ default_llm_model: LLMModel | null }>(`${this.baseUrl}/org-default/`);
  }

  setOrgDefault(modelId: number | null): Observable<{ default_llm_model: LLMModel | null }> {
    return this.http.patch<{ default_llm_model: LLMModel | null }>(
      `${this.baseUrl}/org-default/`,
      { default_llm_model_id: modelId },
    );
  }
}
