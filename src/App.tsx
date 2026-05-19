import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Radar as RadarIcon, Factory, TrendingUp, AlertCircle, ExternalLink, MapPin, DollarSign, Activity, Download, FileText, Plus, Trash2, LayoutDashboard, Briefcase, ArrowLeftRight, Bell, Info, Star } from 'lucide-react';
import { searchIndustrialProjects, Project } from './services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [pipeline, setPipeline] = useState<Project[]>([]);
  const [favorites, setFavorites] = useState<Project[]>([]);
  const [pipelineSearch, setPipelineSearch] = useState('');
  const [pipelineRegion, setPipelineRegion] = useState('');
  const [selectedInPipeline, setSelectedInPipeline] = useState<string[]>([]);
  const [search, setSearch] = useState({ keyword: '', segment: '', region: '', dateLimit: 'all' });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'results' | 'pipeline'>('search');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [notifications, setNotifications] = useState<{id: string, text: string, type: 'info' | 'success' | 'alert', timestamp: Date}[]>([]);

  // Load pipeline and notifications from localStorage
  useEffect(() => {
    const savedPipeline = localStorage.getItem('industrial_pipeline');
    if (savedPipeline) {
      try { setPipeline(JSON.parse(savedPipeline)); }
      catch (e) { console.error("Failed to load pipeline", e); }
    }

    const savedAlerts = localStorage.getItem('industrial_alerts');
    if (savedAlerts) {
      try {
        setNotifications(JSON.parse(savedAlerts).map((n: any) => ({ ...n, timestamp: new Date(n.timestamp) })));
      } catch (e) {
        console.error("Failed to load notifications", e);
      }
    }

    const savedFavorites = localStorage.getItem('industrial_favorites');
    if (savedFavorites) {
      try { setFavorites(JSON.parse(savedFavorites)); }
      catch (e) { console.error("Failed to load favorites", e); }
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('industrial_pipeline', JSON.stringify(pipeline));
  }, [pipeline]);

  useEffect(() => {
    localStorage.setItem('industrial_alerts', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('industrial_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const addNotification = (text: string, type: 'info' | 'success' | 'alert') => {
    const newNote = { id: Math.random().toString(36).substr(2, 9), text, type, timestamp: new Date() };
    setNotifications(prev => [newNote, ...prev].slice(0, 10));
  };

  const addToPipeline = (project: Project) => {
    if (!pipeline.find(p => p.title === project.title)) {
      setPipeline([...pipeline, project]);
      
      // Notification Logic
      addNotification(`Projeto "${project.title}" adicionado ao pipeline.`, 'success');
      
      if (project.priority_score > 85) {
        addNotification(`ALERTA DE PRIORIDADE: "${project.title}" possui match de ${Math.round(project.priority_score)}%.`, 'alert');
      }

      if (project.status?.toLowerCase().includes('aberta')) {
        addNotification(`JANELA DE OPORTUNIDADE: Licitação aberta para "${project.title}".`, 'alert');
      }
    }
  };

  const removeFromPipeline = (projectTitle: string) => {
    setPipeline(pipeline.filter(p => p.title !== projectTitle));
  };

  const toggleFavorite = (project: Project) => {
    const isFav = favorites.find(p => p.title === project.title);
    if (isFav) {
      setFavorites(favorites.filter(p => p.title !== project.title));
      addNotification(`Projeto "${project.title}" removido dos favoritos.`, 'info');
    } else {
      setFavorites([...favorites, project]);
      addNotification(`Projeto "${project.title}" adicionado aos favoritos.`, 'success');
    }
  };

  const togglePipelineSelection = (projectTitle: string) => {
    setSelectedInPipeline(prev => 
      prev.includes(projectTitle) ? prev.filter(t => t !== projectTitle) : [...prev, projectTitle]
    );
  };

  const filteredPipeline = pipeline.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(pipelineSearch.toLowerCase()) || 
                         p.company.toLowerCase().includes(pipelineSearch.toLowerCase());
    const matchesRegion = !pipelineRegion || p.location.includes(pipelineRegion);
    return matchesSearch && matchesRegion;
  });

  const activePipeline = selectedInPipeline.length > 0 
    ? pipeline.filter(p => selectedInPipeline.includes(p.title)) 
    : filteredPipeline;

  const handleSearch = async () => {
    if (!search.keyword.trim()) return;
    setLoading(true);
    setActiveTab('results');
    const results = await searchIndustrialProjects(search.keyword, search.segment, search.region, search.dateLimit);
    setProjects(results);
    setLoading(false);
  };

  const handleTriggerSearch = async (newSearch: typeof search) => {
    if (!newSearch.keyword.trim()) return;
    setLoading(true);
    setActiveTab('results');
    const results = await searchIndustrialProjects(newSearch.keyword, newSearch.segment, newSearch.region, newSearch.dateLimit);
    setProjects(results);
    setLoading(false);
  };

  const formatCurrency = (value: number) => {
    if (!value || value === 0) return 'Sob consulta';
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)}M`;
    return `R$ ${value.toLocaleString('pt-BR')}`;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR');
    } catch {
      return 'N/D';
    }
  };

  const exportToCSV = () => {
    if (projects.length === 0) return;
    
    const headers = ['Título', 'Empresa', 'Tipo', 'Score', 'Valor', 'Status', 'Localização', 'Data', 'URL Source'];
    const rows = projects.map(p => [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.company.replace(/"/g, '""')}"`,
      `"${p.project_type}"`,
      p.priority_score,
      p.estimated_value,
      `"${p.status}"`,
      `"${p.location}"`,
      p.created_at,
      p.url
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `radar_industrial_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    if (projects.length === 0) return;

    const doc = new jsPDF();
    
    // Add Header
    doc.setFontSize(18);
    doc.text('Relatório Radar Industrial', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);
    doc.text(`Total de projetos: ${projects.length}`, 14, 35);

    const tableHeaders = [['Prioridade', 'Projeto', 'Empresa', 'Valor', 'Status', 'Localização']];
    const tableData = projects.map(p => [
      `${Math.round(p.priority_score)}%`,
      p.title,
      p.company,
      formatCurrency(p.estimated_value),
      p.status || 'Em estudo',
      p.location
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableData,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [10, 11, 16], textColor: [59, 130, 246] },
      styles: { fontSize: 8, font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 20 },
        4: { cellWidth: 25 }
      }
    });

    doc.save(`radar_industrial_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen Selection:bg-radar-accent selection:text-white">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-radar-accent to-transparent animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(30,41,59,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(30,41,59,0.1)_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-radar-accent rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                <RadarIcon className="text-white animate-spin-slow" size={24} />
              </div>
              <span className="col-header opacity-100 text-radar-accent font-bold text-sm">Industrial Intelligence v2.1</span>
            </div>
            <h1 className="text-5xl font-black text-white tracking-tighter uppercase mb-2">
              Radar de Projetos<span className="text-radar-accent">.</span>
            </h1>
            <p className="text-slate-400 font-mono text-sm uppercase tracking-wider">
              AI-Driven Industrial Opportunity Mapping & Classification
            </p>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-lg border border-radar-line">
            <button 
              onClick={() => setActiveTab('search')}
              className={`px-4 py-2 rounded font-mono text-[10px] sm:text-xs uppercase tracking-widest transition-all ${activeTab === 'search' ? 'bg-radar-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Scan
            </button>
            <button 
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded font-mono text-[10px] sm:text-xs uppercase tracking-widest transition-all ${activeTab === 'results' ? 'bg-radar-accent text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Scanner ({projects.length})
            </button>
            <button 
              onClick={() => setActiveTab('pipeline')}
              className={`px-4 py-2 rounded font-mono text-[10px] sm:text-xs uppercase tracking-widest transition-all ${activeTab === 'pipeline' ? 'bg-radar-success text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Pipeline ({pipeline.length})
            </button>
          </div>
        </header>

        <main>
          <AnimatePresence mode="wait">
            {activeTab === 'search' ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                <div className="lg:col-span-8">
                  <div className="glass-panel p-10 overflow-hidden relative">
                    {/* Decorative Scanner Pulse */}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-5">
                       <div className="w-[200%] h-1 bg-radar-accent absolute top-0 left-[-50%] animate-scan" />
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-8 border-l-4 border-radar-accent pl-4">Filtros de Varredura</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="space-y-3">
                        <label className="col-header block uppercase">Palavra-Chave / Empresa</label>
                        <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-radar-accent transition-colors" size={20} />
                          <input 
                            type="text" 
                            placeholder='Ex: "Petrobras", "Comperj", "Parada de manutenção"'
                            className="w-full bg-slate-950 border border-radar-line p-4 pl-12 rounded-lg data-value text-white focus:outline-none focus:border-radar-accent focus:ring-1 focus:ring-radar-accent/30 transition-all"
                            value={search.keyword}
                            onChange={(e) => setSearch({ ...search, keyword: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {['Projetos', 'Notícias', 'Investimento', 'Anunciou', 'Licitação', 'Expansão', 'EPC', 'Parada de Manutenção', 'Novo Edital', 'Corporate News', 'Petrobras News', 'Vale Updates'].map((term) => (
                            <button
                              key={term}
                              onClick={() => {
                                const newSearch = { ...search, keyword: term };
                                setSearch(newSearch);
                                handleTriggerSearch(newSearch);
                              }}
                              className="text-[9px] font-mono uppercase bg-slate-900 border border-radar-line px-2 py-1 rounded text-slate-500 hover:border-radar-accent hover:text-radar-accent transition-colors"
                            >
                              + {term}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="col-header block uppercase">Segmento Industrial</label>
                        <select 
                          className="w-full bg-slate-950 border border-radar-line p-4 rounded-lg data-value text-white focus:outline-none focus:border-radar-accent transition-all appearance-none"
                          value={search.segment}
                          onChange={(e) => setSearch({ ...search, segment: e.target.value })}
                        >
                          <option value="">Todos os Segmentos</option>
                          <option value="óleo e gás">🛢️ Óleo e Gás</option>
                          <option value="mineração">⛏️ Mineração</option>
                          <option value="energia">⚡ Energia</option>
                          <option value="petroquímica">🏭 Petroquímica</option>
                          <option value="papel e celulose">📄 Papel e Celulose</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                      <div className="space-y-3">
                        <label className="col-header block uppercase">Região Geográfica</label>
                        <select 
                          className="w-full bg-slate-950 border border-radar-line p-4 rounded-lg data-value text-white focus:outline-none focus:border-radar-accent transition-all appearance-none"
                          value={search.region}
                          onChange={(e) => setSearch({ ...search, region: e.target.value })}
                        >
                          <option value="">Brasil (Toda as Regiões)</option>
                          <option value="Norte">Norte</option>
                          <option value="Nordeste">Nordeste</option>
                          <option value="Sudeste">Sudeste</option>
                          <option value="Sul">Sul</option>
                          <option value="Centro-Oeste">Centro-Oeste</option>
                        </select>
                      </div>

                      <div className="space-y-3">
                        <label className="col-header block uppercase">Janela Temporal (Informação)</label>
                        <select 
                          className="w-full bg-slate-950 border border-radar-line p-4 rounded-lg data-value text-white focus:outline-none focus:border-radar-accent transition-all appearance-none"
                          value={search.dateLimit}
                          onChange={(e) => setSearch({ ...search, dateLimit: e.target.value })}
                        >
                          <option value="all">Todo o histórico</option>
                          <option value="last_week">Última Semana</option>
                          <option value="last_month">Último Mês</option>
                          <option value="last_6_months">Últimos 6 Meses</option>
                          <option value="last_year">Último Ano</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="w-full md:w-1/2">
                        <button 
                          onClick={handleSearch}
                          disabled={loading || !search.keyword}
                          className="w-full bg-radar-accent hover:bg-blue-600 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-black p-4 rounded-lg transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                          {loading ? (
                            <Activity className="animate-spin" size={20} />
                          ) : (
                            <TrendingUp className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} />
                          )}
                          <span className="uppercase tracking-widest font-mono text-sm">
                            {loading ? 'Processando...' : 'Iniciar Varredura'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-950/50 rounded border border-radar-line border-dashed">
                      <div className="flex items-center gap-2 mb-3">
                        <AlertCircle size={14} className="text-radar-warning" />
                        <span className="col-header opacity-100 text-radar-warning">Instruções de Operação</span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono leading-relaxed">
                        A IA irá escanear bases de dados de licitações, notícias de expansão e editais para consolidar oportunidades em formato estruturado. 
                        Tente termos específicos como "EPC contract", "FPSO", ou "Complexo Eólico".
                      </p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-8">
                  <div className="glass-panel p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4">
                      <Activity size={16} className="text-radar-accent opacity-30 animate-pulse" />
                    </div>
                    <div className="w-32 h-32 border border-radar-accent/30 rounded-full mx-auto mb-6 flex items-center justify-center relative">
                      <div className="absolute inset-0 border-t-2 border-radar-accent rounded-full animate-spin-slow opacity-60" />
                      <Factory className="text-radar-accent opacity-80" size={48} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Status do Sistema</h3>
                    <div className="flex justify-center gap-2 mb-6">
                      <div className="w-2 h-2 rounded-full bg-radar-success shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                      <span className="data-value text-[10px] text-radar-success uppercase">Acesso Autorizado</span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono leading-loose uppercase">
                      Classificação automática habilitada via modelo Gemini Flash v3<br/>
                      Latência estimada: 2.4s<br/>
                      Refresh Rate: Realtime
                    </p>
                  </div>
                  
                  <div className="glass-panel p-6 border-radar-warning/20">
                     <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={16} className="text-radar-warning" />
                        <h4 className="col-header opacity-100 text-radar-warning">Top Trends</h4>
                     </div>
                     <ul className="space-y-4 font-mono text-[11px] uppercase text-slate-400">
                        <li className="flex justify-between items-center border-b border-radar-line pb-2">
                           <span>Transição Energética</span>
                           <span className="text-radar-success">+12.4%</span>
                        </li>
                        <li className="flex justify-between items-center border-b border-radar-line pb-2">
                           <span>EPC Pipeline</span>
                           <span className="text-radar-accent">Estável</span>
                        </li>
                        <li className="flex justify-between items-center">
                           <span>Manutenção Corretiva</span>
                           <span className="text-radar-warning">Alerta</span>
                        </li>
                     </ul>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'results' ? (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-8"
              >
                {/* Statistics Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Oportunidades', value: projects.length, icon: RadarIcon, color: 'text-radar-accent' },
                    { label: 'Valor Estimado Total', value: formatCurrency(projects.reduce((acc, p) => acc + (p.estimated_value || 0), 0)), icon: DollarSign, color: 'text-radar-success' },
                    { label: 'Regiões Ativas', value: new Set(projects.map(p => p.location)).size, icon: MapPin, color: 'text-radar-warning' },
                    { label: 'Score Médio', value: projects.length ? `${Math.round(projects.reduce((acc, p) => acc + p.priority_score, 0) / projects.length)}%` : '0%', icon: TrendingUp, color: 'text-radar-accent' }
                  ].map((stat, i) => (
                    <div key={i} className="glass-panel p-4 flex items-center gap-4">
                      <div className={`p-2 rounded bg-slate-900 border border-radar-line ${stat.color}`}>
                        <stat.icon size={18} />
                      </div>
                      <div>
                        <p className="col-header mb-1">{stat.label}</p>
                        <p className="data-value text-lg text-white">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-3">
                   <button 
                    onClick={exportToCSV}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg border border-radar-line transition-all text-xs font-mono uppercase tracking-widest group"
                   >
                     <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                     CSV
                   </button>
                   <button 
                    onClick={exportToPDF}
                    className="flex items-center gap-2 bg-radar-accent hover:bg-blue-600 text-white px-4 py-2 rounded-lg border border-radar-accent/30 transition-all text-xs font-mono uppercase tracking-widest group"
                   >
                     <FileText size={14} className="group-hover:scale-110 transition-transform" />
                     PDF
                   </button>
                </div>

                {loading ? (
                  <div className="glass-panel p-20 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-radar-accent border-t-transparent rounded-full animate-spin mb-6" />
                    <p className="font-mono text-sm animate-pulse">Sintonizando frequências industriais...</p>
                    <p className="col-header mt-4">A IA está processando o radar de oportunidades</p>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="glass-panel p-20 text-center">
                    <AlertCircle className="mx-auto text-slate-700 mb-4" size={48} />
                    <p className="font-bold text-slate-500 mb-2 uppercase">Nenhum alvo detectado</p>
                    <button onClick={() => setActiveTab('search')} className="text-radar-accent font-mono text-xs hover:underline uppercase tracking-widest">
                       Voltar para a busca
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 overflow-x-auto glass-panel p-1">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-radar-line">
                            <th className="p-4 col-header">Prioridade</th>
                            <th className="p-4 col-header">Projeto / Empresa</th>
                            <th className="p-4 col-header text-right">Valor Estimado</th>
                            <th className="p-4 col-header">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map((project, i) => (
                            <motion.tr 
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => setSelectedProject(project)}
                              className={`data-row ${selectedProject === project ? 'bg-slate-800 text-white border-radar-accent' : ''}`}
                            >
                              <td className="p-4">
                                <div className={`inline-block px-2 py-1 rounded-sm data-value text-[10px] font-bold ${project.priority_score > 80 ? 'bg-radar-success/20 text-radar-success' : 'bg-radar-accent/20 text-radar-accent'}`}>
                                  {Math.round(project.priority_score)}%
                                </div>
                              </td>
                              <td className="p-4">
                                <p className="font-bold text-sm truncate max-w-[300px]">{project.title}</p>
                                <p className="col-header text-[9px] opacity-60 mt-1">{project.company} | {project.location}</p>
                              </td>
                              <td className="p-4 text-right data-value text-sm">
                                {formatCurrency(project.estimated_value)}
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      addToPipeline(project);
                                    }}
                                    className={`p-2 rounded border transition-all ${pipeline.find(p => p.title === project.title) ? 'bg-radar-success/20 border-radar-success text-radar-success cursor-default' : 'bg-slate-900 border-radar-line text-slate-400 hover:border-radar-accent hover:text-radar-accent'}`}
                                    title="Adicionar ao meu Pipeline"
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <div className="relative group/tooltip">
                                    <span className={`text-[9px] uppercase font-mono px-2 py-1 rounded border cursor-help ${project.status?.toLowerCase().includes('aberta') ? 'border-radar-success text-radar-success' : project.status?.toLowerCase().includes('andamento') ? 'border-radar-accent text-radar-accent' : 'border-radar-line text-slate-500'}`}>
                                      {project.status || 'Em estudo'}
                                    </span>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-950 border border-radar-line rounded shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-50 pointer-events-none">
                                      <p className="text-[10px] text-slate-300 font-mono leading-tight">
                                        {project.status?.toLowerCase().includes('aberta') ? 'PROCESSO ATIVO: O edital está publicado e aceitando propostas comerciais.' : 
                                         project.status?.toLowerCase().includes('andamento') ? 'EXECUÇÃO: O projeto já saiu do papel e as obras/serviços estão em curso.' :
                                         project.status?.toLowerCase().includes('estudo') ? 'VIABILIDADE: Fase preliminar de planejamento técnico e financeiro.' :
                                         'STATUS OPERACIONAL: Requer análise detalhada para identificar janelas de oportunidade.'}
                                      </p>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-radar-line" />
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </motion.tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:col-span-4">
                      <AnimatePresence mode="wait">
                        {selectedProject ? (
                          <motion.div
                            key={selectedProject.title}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-panel p-8 sticky top-8 bg-slate-900 border-2 border-radar-accent/30"
                          >
                            <div className="flex justify-between items-start mb-6">
                              <span className="col-header opacity-100 bg-radar-accent/10 text-radar-accent px-3 py-1 rounded uppercase">DETALHES DO ALVO</span>
                              <button onClick={() => setSelectedProject(null)} className="text-slate-500 hover:text-white">✕</button>
                            </div>
                            
                            <h3 className="text-2xl font-black text-white leading-tight mb-4">{selectedProject.title}</h3>
                            
                            <div className="space-y-6 mb-8 text-sm">
                              <div>
                                <label className="col-header block mb-2">Resumo de Operação</label>
                                <p className="text-slate-400 leading-relaxed font-mono text-xs whitespace-pre-line">
                                  {selectedProject.summary}
                                </p>
                              </div>

                              <div>
                                <label className="col-header block mb-2">Segmento Industrial</label>
                                <p className="data-value text-xs uppercase text-slate-300 bg-slate-800/50 inline-block px-2 py-1 rounded">
                                  {selectedProject.project_type}
                                </p>
                              </div>

                              <div>
                                <label className="col-header block mb-2">Localização Geográfica</label>
                                <div className="flex items-center gap-2 text-slate-100">
                                  <MapPin size={16} className="text-radar-accent" />
                                  <p className="data-value text-sm uppercase tracking-tight">
                                    {selectedProject.location || 'Não especificada'}
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="col-header block mb-1">Data de Criação</label>
                                  <p className="data-value text-xs">{formatDate(selectedProject.created_at)}</p>
                                </div>
                                <div>
                                  <label className="col-header block mb-1">Status Atual</label>
                                  <p className={`data-value text-xs uppercase font-bold ${
                                    (() => {
                                      const s = (selectedProject.status || "").toLowerCase();
                                      if (s.includes('aberta') || s.includes('iniciada') || s.includes('open')) return 'text-radar-success';
                                      if (s.includes('suspensa') || s.includes('fechada') || s.includes('cancelada')) return 'text-red-500';
                                      if (s.includes('análise') || s.includes('estudo')) return 'text-radar-warning';
                                      return 'text-radar-accent';
                                    })()
                                  }`}>
                                    {selectedProject.status || 'Não especificado'}
                                  </p>
                                </div>
                              </div>

                              <div className="p-4 bg-slate-950 rounded border border-radar-line">
                                <label className="col-header block mb-2">Fonte da Inteligência</label>
                                <p className="text-[10px] text-radar-accent font-mono mb-3">{selectedProject.source || 'Análise IA via News Scrapping'}</p>
                                
                                {selectedProject.grounding_sources && selectedProject.grounding_sources.length > 0 && (
                                  <div className="space-y-2 mt-2 pt-2 border-t border-radar-line/30">
                                    <p className="text-[9px] uppercase font-mono text-slate-500">Referências Cruzadas:</p>
                                    {selectedProject.grounding_sources.map((s, idx) => (
                                      <a 
                                        key={idx} 
                                        href={s.uri} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-radar-accent truncate"
                                      >
                                        <ExternalLink size={10} />
                                        {s.title}
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-4 flex-col sm:flex-row">
                              <button 
                                onClick={() => addToPipeline(selectedProject)}
                                disabled={!!pipeline.find(p => p.title === selectedProject.title)}
                                className={`flex-1 font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all ${pipeline.find(p => p.title === selectedProject.title) ? 'bg-radar-success/20 text-radar-success cursor-default border border-radar-success/30' : 'bg-radar-success hover:bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-400/30'}`}
                              >
                                <Briefcase size={14} />
                                {pipeline.find(p => p.title === selectedProject.title) ? 'No Pipeline' : 'Adicionar ao Pipeline'}
                              </button>
                              
                              <button 
                                onClick={() => toggleFavorite(selectedProject)}
                                className={`flex-1 font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all border ${favorites.find(p => p.title === selectedProject.title) ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50' : 'bg-slate-800 text-slate-300 border-radar-line hover:border-yellow-500/50 hover:text-yellow-500'}`}
                              >
                                <Star size={14} fill={favorites.find(p => p.title === selectedProject.title) ? "currentColor" : "none"} />
                                {favorites.find(p => p.title === selectedProject.title) ? 'Favoritado' : 'Favoritar'}
                              </button>
                            </div>

                            <div className="flex gap-4 flex-col sm:flex-row">
                              <a 
                                href={selectedProject.url} 
                                target="_blank" 
                                className="flex-1 bg-radar-accent hover:bg-blue-600 text-white font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all"
                              >
                                <ExternalLink size={14} />
                                Ver Documentação
                              </a>
                              {selectedProject.source_url && (
                                <a 
                                  href={selectedProject.source_url} 
                                  target="_blank" 
                                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all border border-radar-line"
                                >
                                  <ExternalLink size={14} />
                                  Ver Fonte
                                </a>
                              )}
                            </div>

                            <div className="flex gap-4 flex-col sm:flex-row mt-2">
                              <button 
                                onClick={() => console.log('Comparing projects...')}
                                className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all border border-radar-line"
                              >
                                <ArrowLeftRight size={14} />
                                Comparar Projetos
                              </button>
                              <button 
                                onClick={() => console.log('Analyzing financials...')}
                                className="flex-1 bg-slate-800/50 hover:bg-slate-800 text-slate-300 font-bold p-3 rounded-lg text-center flex items-center justify-center gap-2 text-xs uppercase font-mono transition-all border border-radar-line"
                              >
                                <TrendingUp size={14} />
                                Analisar Financeiro
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <div className="glass-panel p-8 text-center h-[400px] flex flex-col items-center justify-center border-dashed border-2">
                             <div className="w-12 h-12 rounded-full border border-radar-line flex items-center justify-center mb-4 text-slate-700">
                               <RadarIcon size={24} />
                             </div>
                             <p className="col-header mb-2">Seleção de Dados</p>
                             <p className="text-[10px] text-slate-600 font-mono uppercase">Selecione um projeto na lista lateral para carregar a análise detalhada de inteligência.</p>
                          </div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="pipeline"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-12"
              >
                {/* Pipeline Dashboard Section */}
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row gap-4 items-center justify-between glass-panel p-4 border-radar-line/50">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filtrar no Pipeline (Título ou Empresa)..."
                        className="w-full bg-slate-950 border border-radar-line p-2 pl-10 rounded text-xs text-white focus:outline-none focus:border-radar-accent"
                        value={pipelineSearch}
                        onChange={(e) => setPipelineSearch(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                      <select 
                        className="bg-slate-950 border border-radar-line p-2 rounded text-xs text-white focus:outline-none focus:border-radar-accent min-w-[150px]"
                        value={pipelineRegion}
                        onChange={(e) => setPipelineRegion(e.target.value)}
                      >
                        <option value="">Todas as Regiões</option>
                        <option value="RJ">Sudeste - RJ</option>
                        <option value="SP">Sudeste - SP</option>
                        <option value="MG">Sudeste - MG</option>
                        <option value="BA">Nordeste - BA</option>
                        <option value="RS">Sul - RS</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Notifications / Alerts Panel */}
                  <div className="glass-panel p-8 bg-slate-900/40 border-radar-accent/20">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <Bell className="text-radar-accent animate-pulse" size={20} />
                        <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Alertas do Sistema</h3>
                      </div>
                      <button 
                        onClick={() => setNotifications([])}
                        className="text-[9px] font-mono text-slate-500 hover:text-red-400 uppercase"
                      >
                        Limpar
                      </button>
                    </div>
                    
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="text-center py-10 opacity-30">
                          <Info size={32} className="mx-auto mb-2" />
                          <p className="text-[10px] font-mono">Nenhum alerta recente</p>
                        </div>
                      ) : (
                        notifications.map(note => (
                          <div 
                            key={note.id} 
                            className={`p-3 rounded border text-[11px] font-mono leading-tight ${
                              note.type === 'alert' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 
                              note.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                              'bg-slate-800 border-radar-line text-slate-400'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold uppercase">{note.type}</span>
                              <span className="text-[9px] opacity-60">
                                {note.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p>{note.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Chart 1: Value by Project Type */}
                  <div className="glass-panel p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <LayoutDashboard className="text-radar-accent" size={20} />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Volume por Tipo de Projeto</h3>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const summary: Record<string, number> = {};
                          activePipeline.forEach(p => {
                            const type = p.project_type || 'Outros';
                            summary[type] = (summary[type] || 0) + (p.estimated_value || 0);
                          });
                          return Object.entries(summary).map(([name, value]) => ({ name, value: value / 1000000 }));
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} tick={{ fill: '#94A3B8' }} />
                          <YAxis stroke="#94A3B8" fontSize={10} tick={{ fill: '#94A3B8' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                            itemStyle={{ color: '#3B82F6', fontSize: '12px' }}
                          />
                          <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#94A3B8', fontSize: 10, formatter: (val: number) => `R$${val.toFixed(1)}M` }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="col-header mt-4 text-center">Valores expressos em Milhões de Reais (R$M)</p>
                  </div>

                  {/* Chart 2: Projects by Segment */}
                  <div className="glass-panel p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <Activity className="text-radar-success" size={20} />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Distribuição por Segmento</h3>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={(() => {
                              const segmentCount: Record<string, number> = {};
                              activePipeline.forEach(p => {
                                const type = p.project_type || 'Geral';
                                segmentCount[type] = (segmentCount[type] || 0) + 1;
                              });
                              return Object.entries(segmentCount).map(([name, value]) => ({ name, value }));
                            })()}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {activePipeline.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', textTransform: 'uppercase' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 3: Priority Score Distribution */}
                  <div className="glass-panel p-8">
                    <div className="flex items-center gap-3 mb-8">
                      <TrendingUp className="text-radar-warning" size={20} />
                      <h3 className="text-lg font-bold text-white uppercase tracking-tighter">Análise de Prioridade (Match)</h3>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={(() => {
                          const dist = [
                            { range: '0-20%', count: 0 },
                            { range: '21-40%', count: 0 },
                            { range: '41-60%', count: 0 },
                            { range: '61-80%', count: 0 },
                            { range: '81-100%', count: 0 },
                          ];
                          activePipeline.forEach(p => {
                            const s = p.priority_score;
                            if (s <= 20) dist[0].count++;
                            else if (s <= 40) dist[1].count++;
                            else if (s <= 60) dist[2].count++;
                            else if (s <= 80) dist[3].count++;
                            else dist[4].count++;
                          });
                          return dist;
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                          <XAxis dataKey="range" stroke="#94A3B8" fontSize={10} tick={{ fill: '#94A3B8' }} />
                          <YAxis stroke="#94A3B8" fontSize={10} tick={{ fill: '#94A3B8' }} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #1E293B', borderRadius: '8px' }}
                            itemStyle={{ color: '#F59E0B', fontSize: '12px' }}
                          />
                          <Bar dataKey="count" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="col-header mt-4 text-center">Quantidade de projetos por faixa de score</p>
                  </div>
                </div>

                {/* Favorites Section */}
                {favorites.length > 0 && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-radar-line pb-4">
                      <Star className="text-yellow-500" size={20} fill="currentColor" />
                      <h3 className="text-xl font-bold text-white uppercase tracking-tighter">Projetos Favoritos</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {favorites.map((project, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="glass-panel p-6 border-yellow-500/30 bg-yellow-500/5 group hover:border-yellow-500 transition-all flex flex-col"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <span className="text-[10px] font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-radar-line text-slate-400">
                              {project.project_type}
                            </span>
                            <button onClick={() => toggleFavorite(project)} className="text-yellow-500 hover:text-yellow-400">
                              <Star size={16} fill="currentColor" />
                            </button>
                          </div>
                          
                          <h4 className="text-lg font-bold text-white mb-2 leading-tight flex-grow">{project.title}</h4>
                          <p className="text-[11px] text-slate-500 font-mono uppercase mb-4">{project.company} | {project.location}</p>
                          
                          <div className="flex items-center gap-4 mt-auto">
                            <button 
                              onClick={() => {
                                setSelectedProject(project);
                              }}
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono uppercase p-2 rounded text-center text-slate-300 border border-radar-line"
                            >
                              Detalhes
                            </button>
                            <button 
                              onClick={() => addToPipeline(project)}
                              disabled={!!pipeline.find(p => p.title === project.title)}
                              className={`p-2 rounded border transition-all ${pipeline.find(p => p.title === project.title) ? 'bg-radar-success/20 border-radar-success text-radar-success cursor-default' : 'bg-radar-success/10 border-radar-success/30 text-radar-success hover:bg-radar-success/20'}`}
                              title="Adicionar ao Pipeline"
                            >
                              <Briefcase size={16} />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pipeline List */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center border-b border-radar-line pb-4">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Meus Projetos em Pipeline</h3>
                      <p className="col-header mt-1">Oportunidades salvas para acompanhamento estratégico</p>
                    </div>
                    {pipeline.length > 0 && (
                      <div className="flex gap-4 items-center">
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {selectedInPipeline.length} Selecionados
                        </span>
                        <button 
                          onClick={() => setSelectedInPipeline(selectedInPipeline.length === pipeline.length ? [] : pipeline.map(p => p.title))}
                          className="text-[10px] font-mono text-radar-accent hover:underline uppercase"
                        >
                          {selectedInPipeline.length === pipeline.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                        </button>
                      </div>
                    )}
                  </div>

                  {pipeline.length === 0 ? (
                    <div className="glass-panel p-20 text-center border-dashed">
                      <Briefcase className="mx-auto text-slate-800 mb-4" size={48} />
                      <p className="col-header uppercase">Seu pipeline está vazio</p>
                      <button onClick={() => setActiveTab('results')} className="text-radar-accent font-mono text-xs mt-4 hover:underline">Ir para o Scanner</button>
                    </div>
                  ) : filteredPipeline.length === 0 ? (
                    <div className="glass-panel p-10 text-center border-dashed">
                      <p className="col-header uppercase">Nenhum projeto corresponde aos filtros aplicados</p>
                      <button onClick={() => { setPipelineSearch(''); setPipelineRegion(''); }} className="text-radar-accent font-mono text-xs mt-2 hover:underline">Limpar Filtros</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredPipeline.map((project, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass-panel p-6 border-radar-line group hover:border-radar-accent transition-all flex flex-col"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox"
                                checked={selectedInPipeline.includes(project.title)}
                                onChange={() => togglePipelineSelection(project.title)}
                                className="w-4 h-4 rounded border-radar-line bg-slate-950 text-radar-accent focus:ring-radar-accent"
                              />
                              <span className="text-[10px] font-mono uppercase bg-slate-950 px-2 py-1 rounded border border-radar-line text-slate-400">
                                {project.project_type}
                              </span>
                            </div>
                            <div className="bg-radar-success/10 text-radar-success px-2 py-1 rounded text-[10px] font-bold">
                              {Math.round(project.priority_score)}% MATCH
                            </div>
                          </div>
                          
                          <h4 className="text-lg font-bold text-white mb-2 leading-tight flex-grow">{project.title}</h4>
                          <p className="text-[11px] text-slate-500 font-mono uppercase mb-4">{project.company} | {project.location}</p>
                          
                          <div className="flex items-center gap-2 mb-6">
                            <DollarSign size={14} className="text-radar-success" />
                            <span className="data-value text-radar-success text-sm">{formatCurrency(project.estimated_value)}</span>
                          </div>

                          <div className="flex gap-2">
                             <a 
                              href={project.url} 
                              target="_blank" 
                              className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs font-mono uppercase p-2 rounded text-center text-slate-300"
                             >
                               Fonte
                             </a>
                             <button 
                              onClick={() => removeFromPipeline(project.title)}
                              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded border border-red-500/30 transition-all"
                              title="Remover do Pipeline"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-20 pt-8 border-t border-radar-line flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="col-header">Powered by Google Gemini 2.0</span>
              <div className="w-px h-3 bg-radar-line" />
              <span className="col-header font-bold text-radar-accent">AIS Industrial Core</span>
            </div>
            <p className="data-value text-[10px] opacity-30">© 2026 INDUSTRIAL RADAR • DATA INTEGRITY VERIFIED</p>
        </footer>
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          100% { transform: translateY(100vh); }
        }
        .animate-spin-slow {
          animation: spin 6s linear infinite;
        }
        .animate-scan {
          animation: scan 4s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
