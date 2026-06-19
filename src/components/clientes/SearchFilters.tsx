import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { ClienteFiltros, ClienteTag } from '../../types';

interface SearchFiltersProps {
  filtros: ClienteFiltros;
  onFiltrosChange: (f: ClienteFiltros) => void;
  totalResultados: number;
}

const ORIGENS = ['Site', 'Instagram', 'Shopee', 'WhatsApp', 'Indicacao'];
const STATUSES = ['Ativo', 'Pendente', 'Inativo', 'Novo'];
const ALL_TAGS: ClienteTag[] = ['VIP', 'Atacado', 'Reclamacao', 'Fiel', 'Novo'];

const SearchFilters = ({ filtros, onFiltrosChange, totalResultados }: SearchFiltersProps) => {
  const [panelOpen, setPanelOpen] = useState(false);

  const activeFilterCount = [
    filtros.valorMin > 0 || filtros.valorMax < 300 ? 1 : 0,
    filtros.dataInicio ? 1 : 0,
    filtros.origens.length > 0 ? 1 : 0,
    filtros.statuses.length > 0 ? 1 : 0,
    filtros.tags.length > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const toggleInArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por nome ou WhatsApp..."
            value={filtros.busca}
            onChange={(e) => onFiltrosChange({ ...filtros, busca: e.target.value })}
            style={{
              width: '100%', padding: '0.7rem 1rem 0.7rem 2.6rem',
              borderRadius: 12, border: '1px solid #e2e8f0',
              fontSize: '0.9rem', outline: 'none', background: '#fff',
            }}
          />
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '0.7rem 1rem', borderRadius: 12,
            border: panelOpen ? '1px solid #6366f1' : '1px solid #e2e8f0',
            background: panelOpen ? '#eef2ff' : '#fff',
            color: panelOpen ? '#6366f1' : '#475569',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={16} />
          Filtros
          {activeFilterCount > 0 && (
            <span style={{
              background: '#6366f1', color: '#fff', borderRadius: 10,
              padding: '1px 6px', fontSize: 11, fontWeight: 700,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {totalResultados} clientes
        </span>
      </div>

      {panelOpen && (
        <div style={{
          marginTop: 12, background: '#fff', borderRadius: 12,
          padding: 16, border: '1px solid #f1f5f9',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
        }}>
          {/* Valor Gasto */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Valor Gasto
            </label>
            <input
              type="range"
              min={0}
              max={300}
              value={filtros.valorMax}
              onChange={(e) => onFiltrosChange({ ...filtros, valorMax: Number(e.target.value) })}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginTop: 4 }}>
              <span>R$ 0</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>R$ {filtros.valorMax}{filtros.valorMax >= 300 ? '+' : ''}</span>
            </div>
          </div>

          {/* Recência */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Recência
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => onFiltrosChange({ ...filtros, dataInicio: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => onFiltrosChange({ ...filtros, dataFim: e.target.value })}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              />
            </div>
          </div>

          {/* Origem */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Origem
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ORIGENS.map(o => (
                <button
                  key={o}
                  onClick={() => onFiltrosChange({ ...filtros, origens: toggleInArray(filtros.origens, o) })}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: '1px solid #e2e8f0', cursor: 'pointer',
                    background: filtros.origens.includes(o) ? '#6366f1' : '#fff',
                    color: filtros.origens.includes(o) ? '#fff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Status
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {STATUSES.map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={filtros.statuses.includes(s)}
                    onChange={() => onFiltrosChange({ ...filtros, statuses: toggleInArray(filtros.statuses, s) })}
                    style={{ accentColor: '#6366f1' }}
                  />
                  {s}
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
              Tags
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ALL_TAGS.map(t => (
                <button
                  key={t}
                  onClick={() => onFiltrosChange({ ...filtros, tags: toggleInArray(filtros.tags, t) as ClienteTag[] })}
                  style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: '1px solid #e2e8f0', cursor: 'pointer',
                    background: filtros.tags.includes(t) ? '#6366f1' : '#fff',
                    color: filtros.tags.includes(t) ? '#fff' : '#475569',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Clear all */}
          {activeFilterCount > 0 && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => onFiltrosChange({
                  busca: filtros.busca, valorMin: 0, valorMax: 300,
                  dataInicio: '', dataFim: '', origens: [], statuses: [], tags: [],
                })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 8, fontSize: 12,
                  background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 600,
                }}
              >
                <X size={14} /> Limpar filtros
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilters;
