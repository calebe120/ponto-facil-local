import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Pencil, Trash2, CheckCircle, LogOut, ArrowLeft, DollarSign, TrendingUp, TrendingDown, Wallet, FileDown, Store } from "lucide-react";
import { formatDateBRFromYMD, getSaoPauloTodayYMD, getMonthRangeFromYMD } from "@/lib/brazil-datetime";

interface Lancamento {
  id: string;
  user_id: string;
  conta_modelo_id: string | null;
  loja_id: string | null;
  tipo: "pagar" | "receber";
  descricao: string;
  pessoa: string;
  categoria: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: "aberto" | "pago" | "cancelado";
  observacoes: string;
  documento: string;
  created_at: string;
}

interface Loja {
  id: string;
  nome: string;
  ordem: number;
}

const defaultForm = {
  tipo: "pagar" as "pagar" | "receber",
  descricao: "",
  pessoa: "",
  categoria: "",
  valor: "",
  data_emissao: getSaoPauloTodayYMD(),
  data_vencimento: "",
  observacoes: "",
  documento: "",
  recorrente: false,
  dia_vencimento: "",
};

const ADMIN_PASSWORD = "3255";

const Financeiro = () => {
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [loading, setLoading] = useState(true);

  // Lojas (tabs)
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [currentLojaId, setCurrentLojaId] = useState<string | null>(null);

  // Filters
  const [filterTipo, setFilterTipo] = useState<"todos" | "pagar" | "receber">("todos");
  const [filterStatus, setFilterStatus] = useState<"todos" | "aberto" | "pago" | "cancelado">("todos");
  const currentMonthRange = getMonthRangeFromYMD(getSaoPauloTodayYMD());
  const [filterStart, setFilterStart] = useState(currentMonthRange.firstDay);
  const [filterEnd, setFilterEnd] = useState(currentMonthRange.lastDay);
  const [draftStart, setDraftStart] = useState(currentMonthRange.firstDay);
  const [draftEnd, setDraftEnd] = useState(currentMonthRange.lastDay);

  // Form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Liquidar dialog
  const [liquidarOpen, setLiquidarOpen] = useState(false);
  const [liquidarId, setLiquidarId] = useState<string | null>(null);
  const [liquidarDate, setLiquidarDate] = useState(getSaoPauloTodayYMD());

  // Loja dialogs
  const [lojaDialogOpen, setLojaDialogOpen] = useState(false);
  const [lojaEditing, setLojaEditing] = useState<Loja | null>(null);
  const [lojaNome, setLojaNome] = useState("");
  const [lojaPassword, setLojaPassword] = useState("");
  const [lojaDeleteOpen, setLojaDeleteOpen] = useState(false);
  const [lojaDeleteTarget, setLojaDeleteTarget] = useState<Loja | null>(null);
  const [lojaDeletePwd, setLojaDeletePwd] = useState("");

  useEffect(() => {
    if (!authLoading) {
      if (!session) navigate("/auth");
    }
  }, [authLoading, session, navigate]);

  // Load lojas; bootstrap a default one if none exists; migrate any orphan rows
  const loadLojas = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("lojas")
      .select("*")
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    let list = (data as Loja[]) || [];
    if (list.length === 0) {
      const { data: novo, error: e2 } = await supabase
        .from("lojas")
        .insert({ user_id: user.id, nome: "Loja Principal", ordem: 0 })
        .select("*")
        .single();
      if (e2) {
        console.error(e2);
        return;
      }
      list = [novo as Loja];
      // Migrate existing rows without loja_id to this loja
      await supabase.from("lancamentos_financeiros").update({ loja_id: novo.id }).is("loja_id", null);
      await supabase.from("contas_modelo").update({ loja_id: novo.id }).is("loja_id", null);
    }
    setLojas(list);
    setCurrentLojaId((prev) => prev && list.some((l) => l.id === prev) ? prev : list[0].id);
  }, [user]);

  const loadLancamentos = useCallback(async (lojaId: string) => {
    if (!user || !lojaId) return;
    const { data, error } = await supabase
      .from("lancamentos_financeiros")
      .select("*")
      .eq("loja_id", lojaId)
      .order("data_vencimento", { ascending: true });
    if (error) {
      console.error(error);
      toast.error("Erro ao carregar lançamentos");
      return;
    }
    setLancamentos((data as any[]) || []);
  }, [user]);

  // Generate recurring entries for the current loja for a given month range
  const generateRecurringForRange = useCallback(async (lojaId: string, startYMD: string, endYMD: string) => {
    if (!user || !lojaId || !startYMD || !endYMD) return;
    try {
      const { data: modelos, error } = await supabase
        .from("contas_modelo")
        .select("*")
        .eq("recorrente", true)
        .eq("loja_id", lojaId);
      if (error || !modelos) return;

      const [sy, sm] = startYMD.split("-").map(Number);
      const [ey, em] = endYMD.split("-").map(Number);
      if (!sy || !sm || !ey || !em) return;

      const months: { y: number; m: number }[] = [];
      let cy = sy, cm = sm;
      while (cy < ey || (cy === ey && cm <= em)) {
        months.push({ y: cy, m: cm });
        cm += 1;
        if (cm > 12) { cm = 1; cy += 1; }
      }

      const today = getSaoPauloTodayYMD();

      for (const modelo of modelos as any[]) {
        const dia = modelo.dia_vencimento || 1;
        for (const { y, m } of months) {
          const lastDay = new Date(y, m, 0).getDate();
          const realDia = Math.min(dia, lastDay);
          const vencimento = `${y}-${String(m).padStart(2, "0")}-${String(realDia).padStart(2, "0")}`;
          await supabase.from("lancamentos_financeiros").upsert({
            user_id: modelo.user_id,
            conta_modelo_id: modelo.id,
            loja_id: lojaId,
            tipo: modelo.tipo,
            descricao: modelo.descricao,
            pessoa: modelo.pessoa,
            categoria: modelo.categoria,
            valor: modelo.valor,
            data_emissao: vencimento <= today ? vencimento : today,
            data_vencimento: vencimento,
            status: "aberto",
            observacoes: modelo.observacoes || "",
            documento: modelo.documento || "",
          }, { onConflict: "conta_modelo_id,data_vencimento", ignoreDuplicates: true });
        }
      }
    } catch (e) {
      console.error("Error generating recurring:", e);
    }
  }, [user]);

  // Bootstrap on user
  useEffect(() => {
    if (user) {
      loadLojas().finally(() => setLoading(false));
    }
  }, [user, loadLojas]);

  // When loja changes, generate recurring + load
  const initRanRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!currentLojaId) return;
    (async () => {
      if (!initRanRef.current[currentLojaId]) {
        initRanRef.current[currentLojaId] = true;
        await generateRecurringForRange(currentLojaId, currentMonthRange.firstDay, currentMonthRange.lastDay);
      }
      await loadLancamentos(currentLojaId);
    })();
  }, [currentLojaId, generateRecurringForRange, loadLancamentos, currentMonthRange.firstDay, currentMonthRange.lastDay]);

  const handlePesquisar = async () => {
    if (!currentLojaId) return;
    setFilterStart(draftStart);
    setFilterEnd(draftEnd);
    if (draftStart && draftEnd) {
      await generateRecurringForRange(currentLojaId, draftStart, draftEnd);
    }
    await loadLancamentos(currentLojaId);
  };

  const filtered = lancamentos.filter((l) => {
    if (filterTipo !== "todos" && l.tipo !== filterTipo) return false;
    if (filterStatus !== "todos" && l.status !== filterStatus) return false;
    if (filterStart && l.data_vencimento < filterStart) return false;
    if (filterEnd && l.data_vencimento > filterEnd) return false;
    return true;
  });

  const today = getSaoPauloTodayYMD();
  const totalPagar = filtered.filter((l) => l.tipo === "pagar" && l.status === "aberto").reduce((s, l) => s + Number(l.valor), 0);
  const totalReceber = filtered.filter((l) => l.tipo === "receber" && l.status === "aberto").reduce((s, l) => s + Number(l.valor), 0);
  const saldoPrevisto = totalReceber - totalPagar;

  const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const getStatusBadge = (l: Lancamento) => {
    if (l.status === "pago") return <Badge className="bg-green-600 text-white">Pago</Badge>;
    if (l.status === "cancelado") return <Badge variant="secondary">Cancelado</Badge>;
    if (l.data_vencimento < today) return <Badge className="bg-red-600 text-white">Vencido</Badge>;
    if (l.data_vencimento === today) return <Badge className="bg-yellow-500 text-black">Vence Hoje</Badge>;
    return <Badge variant="outline">Aberto</Badge>;
  };

  const openNewForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setFormOpen(true);
  };

  const openEditForm = (l: Lancamento) => {
    setEditingId(l.id);
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      pessoa: l.pessoa,
      categoria: l.categoria,
      valor: String(l.valor),
      data_emissao: l.data_emissao,
      data_vencimento: l.data_vencimento,
      observacoes: l.observacoes || "",
      documento: l.documento || "",
      recorrente: false,
      dia_vencimento: "",
    });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!user || !currentLojaId) return;
    if (!form.descricao || !form.pessoa || !form.valor || !form.data_vencimento) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      const valorNum = parseFloat(form.valor.replace(",", "."));
      if (isNaN(valorNum) || valorNum <= 0) {
        toast.error("Valor inválido");
        return;
      }

      if (editingId) {
        const { error } = await supabase
          .from("lancamentos_financeiros")
          .update({
            tipo: form.tipo,
            descricao: form.descricao,
            pessoa: form.pessoa,
            categoria: form.categoria,
            valor: valorNum,
            data_emissao: form.data_emissao,
            data_vencimento: form.data_vencimento,
            observacoes: form.observacoes,
            documento: form.documento,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Lançamento atualizado");
      } else if (form.recorrente) {
        const diaVenc = form.dia_vencimento ? parseInt(form.dia_vencimento) : null;
        const { data: modelo, error: modeloError } = await supabase
          .from("contas_modelo")
          .insert({
            user_id: user.id,
            loja_id: currentLojaId,
            tipo: form.tipo,
            descricao: form.descricao,
            pessoa: form.pessoa,
            categoria: form.categoria,
            valor: valorNum,
            recorrente: true,
            dia_vencimento: diaVenc,
            observacoes: form.observacoes,
            documento: form.documento,
          })
          .select("id")
          .single();
        if (modeloError) throw modeloError;

        const { error } = await supabase.from("lancamentos_financeiros").upsert({
          user_id: user.id,
          conta_modelo_id: modelo.id,
          loja_id: currentLojaId,
          tipo: form.tipo,
          descricao: form.descricao,
          pessoa: form.pessoa,
          categoria: form.categoria,
          valor: valorNum,
          data_emissao: form.data_emissao,
          data_vencimento: form.data_vencimento,
          observacoes: form.observacoes,
          documento: form.documento,
          status: "aberto",
        }, { onConflict: "conta_modelo_id,data_vencimento", ignoreDuplicates: true });
        if (error) throw error;
        toast.success("Lançamento recorrente criado");
      } else {
        const { error } = await supabase.from("lancamentos_financeiros").insert({
          user_id: user.id,
          loja_id: currentLojaId,
          tipo: form.tipo,
          descricao: form.descricao,
          pessoa: form.pessoa,
          categoria: form.categoria,
          valor: valorNum,
          data_emissao: form.data_emissao,
          data_vencimento: form.data_vencimento,
          observacoes: form.observacoes,
          documento: form.documento,
          status: "aberto",
        });
        if (error) throw error;
        toast.success("Lançamento criado");
      }

      setFormOpen(false);
      await loadLancamentos(currentLojaId);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar");
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !currentLojaId) return;
    try {
      const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Lançamento excluído");
      setDeleteOpen(false);
      await loadLancamentos(currentLojaId);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao excluir");
    }
  };

  const handleLiquidar = async () => {
    if (!liquidarId || !currentLojaId) return;
    try {
      const { error } = await supabase
        .from("lancamentos_financeiros")
        .update({ status: "pago", data_pagamento: liquidarDate })
        .eq("id", liquidarId);
      if (error) throw error;
      toast.success("Conta liquidada");
      setLiquidarOpen(false);
      await loadLancamentos(currentLojaId);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao liquidar");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  // ===== Lojas handlers =====
  const openNewLoja = () => {
    setLojaEditing(null);
    setLojaNome("");
    setLojaPassword("");
    setLojaDialogOpen(true);
  };

  const openEditLoja = (loja: Loja) => {
    setLojaEditing(loja);
    setLojaNome(loja.nome);
    setLojaPassword("");
    setLojaDialogOpen(true);
  };

  const saveLoja = async () => {
    if (!user) return;
    if (!lojaNome.trim()) {
      toast.error("Informe o nome da loja");
      return;
    }
    if (lojaEditing) {
      if (lojaPassword !== ADMIN_PASSWORD) {
        toast.error("Senha incorreta");
        return;
      }
      const { error } = await supabase.from("lojas").update({ nome: lojaNome.trim() }).eq("id", lojaEditing.id);
      if (error) { toast.error("Erro ao salvar"); return; }
      toast.success("Loja atualizada");
    } else {
      const ordem = lojas.length;
      const { data, error } = await supabase
        .from("lojas")
        .insert({ user_id: user.id, nome: lojaNome.trim(), ordem })
        .select("*")
        .single();
      if (error) { toast.error("Erro ao criar loja"); return; }
      toast.success("Loja criada");
      setCurrentLojaId((data as Loja).id);
    }
    setLojaDialogOpen(false);
    await loadLojas();
  };

  const confirmDeleteLoja = async () => {
    if (!lojaDeleteTarget) return;
    if (lojaDeletePwd !== ADMIN_PASSWORD) {
      toast.error("Senha incorreta");
      return;
    }
    const { error } = await supabase.from("lojas").delete().eq("id", lojaDeleteTarget.id);
    if (error) { toast.error("Erro ao excluir loja"); return; }
    toast.success("Loja excluída");
    setLojaDeleteOpen(false);
    setLojaDeletePwd("");
    const remaining = lojas.filter((l) => l.id !== lojaDeleteTarget.id);
    if (currentLojaId === lojaDeleteTarget.id) {
      setCurrentLojaId(remaining[0]?.id || null);
    }
    setLojaDeleteTarget(null);
    await loadLojas();
  };

  const exportRelatorio = () => {
    if (filtered.length === 0) {
      toast.error("Nenhum lançamento para exportar");
      return;
    }
    const lojaNomeAtual = lojas.find((l) => l.id === currentLojaId)?.nome || "Loja";
    const headers = ["Tipo", "Descrição", "Pessoa", "Categoria", "Emissão", "Vencimento", "Pagamento", "Valor", "Status", "Documento", "Observações"];
    const rows = filtered.map((l) => [
      l.tipo === "pagar" ? "A Pagar" : "A Receber",
      l.descricao,
      l.pessoa,
      l.categoria,
      formatDateBRFromYMD(l.data_emissao),
      formatDateBRFromYMD(l.data_vencimento),
      l.data_pagamento ? formatDateBRFromYMD(l.data_pagamento) : "",
      Number(l.valor).toFixed(2).replace(".", ","),
      l.status,
      l.documento || "",
      (l.observacoes || "").replace(/\n/g, " "),
    ]);
    const totalPagarAll = filtered.filter((l) => l.tipo === "pagar").reduce((s, l) => s + Number(l.valor), 0);
    const totalReceberAll = filtered.filter((l) => l.tipo === "receber").reduce((s, l) => s + Number(l.valor), 0);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      [`Loja: ${lojaNomeAtual}`].map(escape).join(";"),
      "",
      headers.map(escape).join(";"),
      ...rows.map((r) => r.map((c) => escape(String(c))).join(";")),
      "",
      ["", "", "", "", "", "", "Total a Pagar", totalPagarAll.toFixed(2).replace(".", ","), "", "", ""].map(escape).join(";"),
      ["", "", "", "", "", "", "Total a Receber", totalReceberAll.toFixed(2).replace(".", ","), "", "", ""].map(escape).join(";"),
      ["", "", "", "", "", "", "Saldo", (totalReceberAll - totalPagarAll).toFixed(2).replace(".", ","), "", "", ""].map(escape).join(";"),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${lojaNomeAtual.replace(/\s+/g, "_")}-${filterStart || "inicio"}-a-${filterEnd || "fim"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const currentLoja = lojas.find((l) => l.id === currentLojaId);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Financeiro</h1>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Tabs de Lojas (estilo Excel) */}
        <Card>
          <CardContent className="p-2">
            <div className="flex items-center gap-1 overflow-x-auto">
              {lojas.map((loja) => {
                const active = loja.id === currentLojaId;
                return (
                  <div
                    key={loja.id}
                    className={`group flex items-center gap-1 px-3 py-2 rounded-t-md border-b-2 cursor-pointer whitespace-nowrap transition-colors ${
                      active
                        ? "bg-background border-primary text-foreground font-semibold"
                        : "bg-muted/50 border-transparent text-muted-foreground hover:bg-muted"
                    }`}
                    onClick={() => setCurrentLojaId(loja.id)}
                  >
                    <Store className="h-3.5 w-3.5" />
                    <span>{loja.nome}</span>
                    {active && (
                      <>
                        <button
                          className="ml-1 opacity-60 hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); openEditLoja(loja); }}
                          title="Renomear"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {lojas.length > 1 && (
                          <button
                            className="opacity-60 hover:opacity-100 text-destructive"
                            onClick={(e) => { e.stopPropagation(); setLojaDeleteTarget(loja); setLojaDeletePwd(""); setLojaDeleteOpen(true); }}
                            title="Excluir loja"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
              <Button variant="ghost" size="sm" className="ml-1" onClick={openNewLoja} title="Nova loja">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Total a Pagar {currentLoja && <span className="text-xs">— {currentLoja.nome}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalPagar)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Total a Receber
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceber)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Saldo Previsto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${saldoPrevisto >= 0 ? "text-green-600" : "text-destructive"}`}>
                {formatCurrency(saldoPrevisto)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="w-40">
                <Label className="text-xs">Tipo</Label>
                <Select value={filterTipo} onValueChange={(v) => setFilterTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagar">A Pagar</SelectItem>
                    <SelectItem value="receber">A Receber</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">Situação</Label>
                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="aberto">Em Aberto</SelectItem>
                    <SelectItem value="pago">Pagos</SelectItem>
                    <SelectItem value="cancelado">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">Data Inicial</Label>
                <Input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
              </div>
              <div className="w-40">
                <Label className="text-xs">Data Final</Label>
                <Input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
              </div>
              <Button size="sm" onClick={handlePesquisar}>Pesquisar</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const r = getMonthRangeFromYMD(getSaoPauloTodayYMD());
                  setDraftStart(r.firstDay);
                  setDraftEnd(r.lastDay);
                  setFilterStart(r.firstDay);
                  setFilterEnd(r.lastDay);
                  setFilterTipo("todos");
                  setFilterStatus("todos");
                  if (currentLojaId) {
                    await generateRecurringForRange(currentLojaId, r.firstDay, r.lastDay);
                    await loadLancamentos(currentLojaId);
                  }
                }}
              >
                Mês atual
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraftStart("");
                  setDraftEnd("");
                  setFilterStart("");
                  setFilterEnd("");
                  setFilterTipo("todos");
                  setFilterStatus("todos");
                }}
              >
                Limpar
              </Button>
              <div className="ml-auto flex gap-2">
                <Button variant="outline" onClick={exportRelatorio}>
                  <FileDown className="h-4 w-4 mr-2" /> Relatório
                </Button>
                <Button onClick={openNewForm}>
                  <Plus className="h-4 w-4 mr-2" /> Novo Lançamento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Pessoa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum lançamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((l) => (
                      <TableRow key={l.id} className={
                        l.status === "pago"
                          ? "bg-green-50 dark:bg-green-950/20"
                          : l.status === "aberto" && l.data_vencimento < today
                          ? "bg-red-50 dark:bg-red-950/20"
                          : l.status === "aberto" && l.data_vencimento === today
                          ? "bg-yellow-50 dark:bg-yellow-950/20"
                          : ""
                      }>
                        <TableCell>
                          <Badge variant={l.tipo === "pagar" ? "destructive" : "default"} className={l.tipo === "receber" ? "bg-green-600 text-white" : ""}>
                            {l.tipo === "pagar" ? "Pagar" : "Receber"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell>{l.pessoa}</TableCell>
                        <TableCell>{l.categoria}</TableCell>
                        <TableCell>{formatDateBRFromYMD(l.data_vencimento)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(Number(l.valor))}</TableCell>
                        <TableCell>{getStatusBadge(l)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 justify-end">
                            {l.status === "aberto" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600"
                                onClick={() => { setLiquidarId(l.id); setLiquidarDate(getSaoPauloTodayYMD()); setLiquidarOpen(true); }}
                                title="Liquidar"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditForm(l)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={() => { setDeleteId(l.id); setDeleteOpen(true); }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Form Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagar">A Pagar</SelectItem>
                  <SelectItem value="receber">A Receber</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Pessoa / Fornecedor *</Label>
              <Input value={form.pessoa} onChange={(e) => setForm({ ...form, pessoa: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} placeholder="Ex: Aluguel, Salário, Material..." />
            </div>
            <div>
              <Label>Valor *</Label>
              <Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data Emissão</Label>
                <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
              </div>
              <div>
                <Label>Data Vencimento *</Label>
                <Input type="date" value={form.data_vencimento} onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Documento / Referência</Label>
              <Input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} placeholder="NF, Boleto, etc." />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
            </div>

            {!editingId && (
              <div className="border rounded-lg p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="recorrente"
                    checked={form.recorrente}
                    onCheckedChange={(v) => setForm({ ...form, recorrente: !!v })}
                  />
                  <Label htmlFor="recorrente" className="cursor-pointer">Repetir mensalmente</Label>
                </div>
                {form.recorrente && (
                  <div className="w-32">
                    <Label className="text-xs">Dia do vencimento (1-31)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={form.dia_vencimento}
                      onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={saveForm}>{editingId ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Lançamento Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">Tem certeza que deseja excluir este lançamento?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Liquidar Dialog */}
      <Dialog open={liquidarOpen} onOpenChange={setLiquidarOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liquidar Conta</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Data do Pagamento</Label>
            <Input type="date" value={liquidarDate} onChange={(e) => setLiquidarDate(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLiquidarOpen(false)}>Cancelar</Button>
            <Button onClick={handleLiquidar} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Liquidação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loja Create/Edit Dialog */}
      <Dialog open={lojaDialogOpen} onOpenChange={setLojaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lojaEditing ? "Renomear Loja" : "Nova Loja"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Loja</Label>
              <Input value={lojaNome} onChange={(e) => setLojaNome(e.target.value)} placeholder="Ex: Loja Centro" />
            </div>
            {lojaEditing && (
              <div>
                <Label>Senha de administrador</Label>
                <Input type="password" value={lojaPassword} onChange={(e) => setLojaPassword(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLojaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveLoja}>{lojaEditing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loja Delete Dialog */}
      <Dialog open={lojaDeleteOpen} onOpenChange={setLojaDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Loja</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir <strong>{lojaDeleteTarget?.nome}</strong>? Todos os lançamentos e contas recorrentes desta loja serão excluídos permanentemente.
          </p>
          <div>
            <Label>Senha de administrador</Label>
            <Input type="password" value={lojaDeletePwd} onChange={(e) => setLojaDeletePwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLojaDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDeleteLoja}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Financeiro;
