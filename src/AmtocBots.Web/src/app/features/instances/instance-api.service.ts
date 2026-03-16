import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { InstanceSummary, InstanceDetail, ChannelConfig } from './instance.models';

@Injectable({ providedIn: 'root' })
export class InstanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBase}/instances`;

  list()                        { return this.http.get<InstanceSummary[]>(this.base); }
  get(id: string)               { return this.http.get<InstanceDetail>(`${this.base}/${id}`); }
  create(req: CreateInstanceReq){ return this.http.post<{ instanceId: string; token: string }>(this.base, req); }
  update(id: string, req: Partial<CreateInstanceReq>) { return this.http.put<void>(`${this.base}/${id}`, req); }
  delete(id: string)            { return this.http.delete<void>(`${this.base}/${id}`); }

  start(id: string)   { return this.http.post<{ containerId: string }>(`${this.base}/${id}/start`,   {}); }
  stop(id: string)    { return this.http.post<void>(`${this.base}/${id}/stop`,    {}); }
  restart(id: string) { return this.http.post<void>(`${this.base}/${id}/restart`, {}); }

  getConfig(id: string) { return this.http.get(`${this.base}/${id}/config`, { responseType: 'text' }); }

  listChannels(id: string) { return this.http.get<ChannelConfig[]>(`${environment.apiBase}/channels/instances/${id}/channels`); }
}

export interface CreateInstanceReq {
  name: string;
  description?: string;
  model: string;
  cpuLimit?: number;
  memoryLimitMb?: number;
}
