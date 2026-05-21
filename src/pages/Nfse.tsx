import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, FileText, Plus, Download, Trash2, Edit } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateBRFromYMD, getSaoPauloTodayYMD } from "@/lib/brazil-datetime";

interface Loja {
  id: string;
  nome: string;
}

interface Nfse {
  id: string;
  numero: string;
  serie: string;
  data_emissao: string;
  loja_id: string | null;
  prestador_razao_social: string;
  prestador_cnpj: string;
  prestador_inscricao_municipal: string | null;
  prestador_endereco: string | null;
  tomador_nome: string;
  tomador_documento: string;
  tomador_endereco: string | null;
  tomador_email: string | null;
  descricao_servico: string;
  codigo_servico: string | null;
  valor_servico: number;
  aliquota_iss: number;
  valor_iss: number;
  valor_liquido: number;
  observacoes: string | null;
  status: string;
}

const emptyForm = {
  numero: "",
  serie: "1",
  data_emissao: getSaoPauloTodayYMD(),
  loja_id: "",
  prestador_razao_social: "",
  prestador_cnpj: "",
  prestador_inscricao_municipal: "",
  prestador_endereco: "",
  tomador_nome: "",
  tomador_documento: "",
  tomador_endereco: "",
  tomador_email: "",
  descricao_servico: "",
  codigo_servico: "",
  valor_servico: "0",
  aliquota_iss: "0",
  observacoes: "",
};

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Nfse = () => {
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [notas, setNotas] = useState<Nfse[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !session) navigate("/auth");
    else if (session) setLoading(false);
  }, [authLoading, session, navigate]);

  useEffect(() => {
    if (user) {
      loadLojas();
      loadNotas();
    }
  }, [user]);

  const loadLojas = async () => {
    const { data } = await supabase
      .from("lojas")
      .select("id, nome")
      .order("ordem", { ascending: true });
    setLojas(data || []);
  };

  const loadNotas = async () => {
    const { data, error } = await supabase
      .from("nfse")
      .select("*")
      .order("data_emissao", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar notas");
      return;
    }
    setNotas((data as any) || []);
  };

  const openNew = async () => {
    setEditingId(null);
    const { data } = await supabase
      .from("nfse")
      .select("numero")
      .order("created_at", { ascending: false })
      .limit(1);
    let nextNumero = "1";
    if (data && data.length > 0) {
      const n = parseInt(data[0].numero, 10);
      if (!isNaN(n)) nextNumero = String(n + 1);
    }
    setForm({ ...emptyForm, numero: nextNumero, loja_id: lojas[0]?.id || "" });
    setDialogOpen(true);
  };

  const openEdit = (n: Nfse) => {
    setEditingId(n.id);
    setForm({
      numero: n.numero,
      serie: n.serie,
      data_emissao: n.data_emissao,
      loja_id: n.loja_id || "",
      prestador_razao_social: n.prestador_razao_social,
      prestador_cnpj: n.prestador_cnpj,
      prestador_inscricao_municipal: n.prestador_inscricao_municipal || "",
      prestador_endereco: n.prestador_endereco || "",
      tomador_nome: n.tomador_nome,
      tomador_documento: n.tomador_documento,
      tomador_endereco: n.tomador_endereco || "",
      tomador_email: n.tomador_email || "",
      descricao_servico: n.descricao_servico,
      codigo_servico: n.codigo_servico || "",
      valor_servico: String(n.valor_servico),
      aliquota_iss: String(n.aliquota_iss),
      observacoes: n.observacoes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.numero || !form.prestador_razao_social || !form.prestador_cnpj || !form.tomador_nome || !form.tomador_documento || !form.descricao_servico) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const valor = parseFloat(form.valor_servico) || 0;
    const aliquota = parseFloat(form.aliquota_iss) || 0;
    const valor_iss = +(valor * (aliquota / 100)).toFixed(2);
    const valor_liquido = +(valor - valor_iss).toFixed(2);

    const payload: any = {
      user_id: user.id,
      loja_id: form.loja_id || null,
      numero: form.numero,
      serie: form.serie,
      data_emissao: form.data_emissao,
      prestador_razao_social: form.prestador_razao_social,
      prestador_cnpj: form.prestador_cnpj,
      prestador_inscricao_municipal: form.prestador_inscricao_municipal || null,
      prestador_endereco: form.prestador_endereco || null,
      tomador_nome: form.tomador_nome,
      tomador_documento: form.tomador_documento,
      tomador_endereco: form.tomador_endereco || null,
      tomador_email: form.tomador_email || null,
      descricao_servico: form.descricao_servico,
      codigo_servico: form.codigo_servico || null,
      valor_servico: valor,
      aliquota_iss: aliquota,
      valor_iss,
      valor_liquido,
      observacoes: form.observacoes || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("nfse").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("nfse").insert(payload));
    }
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success(editingId ? "Nota atualizada" : "Nota emitida com sucesso");
    setDialogOpen(false);
    loadNotas();
  };

  const askDelete = (id: string) => {
    setDeleteId(id);
    setDeletePassword("");
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deletePassword !== "3255") {
      toast.error("Senha incorreta");
      return;
    }
    if (!deleteId) return;
    const { error } = await supabase.from("nfse").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Nota excluída");
    setDeleteDialogOpen(false);
    loadNotas();
  };

  const gerarPDF = (n: Nfse) => {
    const doc = new jsPDF();
    const lojaNome = lojas.find((l) => l.id === n.loja_id)?.nome || "";

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("NOTA FISCAL DE SERVIÇOS ELETRÔNICA - NFS-e", 105, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Município de Aparecida de Goiânia - GO", 105, 22, { align: "center" });

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Nº ${n.numero}    Série: ${n.serie}`, 14, 32);
    doc.text(`Emissão: ${formatDateBRFromYMD(n.data_emissao)}`, 140, 32);

    autoTable(doc, {
      startY: 38,
      head: [["PRESTADOR DE SERVIÇOS"]],
      body: [[
        `Razão Social: ${n.prestador_razao_social}\n` +
        `CNPJ: ${n.prestador_cnpj}    Inscr. Municipal: ${n.prestador_inscricao_municipal || "—"}\n` +
        `Endereço: ${n.prestador_endereco || "—"}` +
        (lojaNome ? `\nLoja: ${lojaNome}` : "")
      ]],
      theme: "grid",
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      head: [["TOMADOR DE SERVIÇOS"]],
      body: [[
        `Nome/Razão Social: ${n.tomador_nome}\n` +
        `CPF/CNPJ: ${n.tomador_documento}\n` +
        `Endereço: ${n.tomador_endereco || "—"}\n` +
        `E-mail: ${n.tomador_email || "—"}`
      ]],
      theme: "grid",
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 9 },
    });

    autoTable(doc, {
      head: [["DISCRIMINAÇÃO DOS SERVIÇOS"]],
      body: [[
        (n.codigo_servico ? `Código: ${n.codigo_servico}\n` : "") + n.descricao_servico
      ]],
      theme: "grid",
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 9, minCellHeight: 30 },
    });

    autoTable(doc, {
      head: [["Valor dos Serviços", "Alíquota ISS", "Valor ISS", "Valor Líquido"]],
      body: [[
        formatCurrency(n.valor_servico),
        `${n.aliquota_iss}%`,
        formatCurrency(n.valor_iss),
        formatCurrency(n.valor_liquido),
      ]],
      theme: "grid",
      headStyles: { fillColor: [60, 60, 60] },
      styles: { fontSize: 10, halign: "center" },
    });

    if (n.observacoes) {
      autoTable(doc, {
        head: [["OBSERVAÇÕES"]],
        body: [[n.observacoes]],
        theme: "grid",
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 9 },
      });
    }

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(8);
    doc.text(
      "Documento emitido manualmente pelo sistema interno. Não substitui a NFS-e oficial emitida pela prefeitura.",
      105,
      finalY,
      { align: "center", maxWidth: 180 }
    );

    doc.save(`NFSe-${n.numero}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <FileText className="w-7 h-7 text-accent" /> Notas Fiscais de Serviço
          </h1>
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Nova Nota
          </Button>
        </div>

        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Emissão manual de NFS-e (Aparecida de Goiânia - GO). Os dados são preenchidos
            manualmente e um PDF interno é gerado. Este documento não substitui a nota oficial
            registrada na prefeitura.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Tomador</TableHead>
                <TableHead>Loja</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">ISS</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhuma nota emitida ainda
                  </TableCell>
                </TableRow>
              )}
              {notas.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.numero}</TableCell>
                  <TableCell>{formatDateBRFromYMD(n.data_emissao)}</TableCell>
                  <TableCell>{n.tomador_nome}</TableCell>
                  <TableCell>{lojas.find((l) => l.id === n.loja_id)?.nome || "—"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(n.valor_servico)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(n.valor_iss)}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(n.valor_liquido)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => gerarPDF(n)} title="Baixar PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(n)} title="Editar">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => askDelete(n.id)} title="Excluir">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Nota" : "Nova Nota Fiscal"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Número *</Label>
                <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} />
              </div>
              <div>
                <Label>Série</Label>
                <Input value={form.serie} onChange={(e) => setForm({ ...form, serie: e.target.value })} />
              </div>
              <div>
                <Label>Data Emissão</Label>
                <Input type="date" value={form.data_emissao} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} />
              </div>
              <div>
                <Label>Loja</Label>
                <Select value={form.loja_id} onValueChange={(v) => setForm({ ...form, loja_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {lojas.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="font-semibold mb-2">Prestador</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Razão Social *</Label>
                  <Input value={form.prestador_razao_social} onChange={(e) => setForm({ ...form, prestador_razao_social: e.target.value })} />
                </div>
                <div>
                  <Label>CNPJ *</Label>
                  <Input value={form.prestador_cnpj} onChange={(e) => setForm({ ...form, prestador_cnpj: e.target.value })} />
                </div>
                <div>
                  <Label>Inscrição Municipal</Label>
                  <Input value={form.prestador_inscricao_municipal} onChange={(e) => setForm({ ...form, prestador_inscricao_municipal: e.target.value })} />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input value={form.prestador_endereco} onChange={(e) => setForm({ ...form, prestador_endereco: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="font-semibold mb-2">Tomador</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome / Razão Social *</Label>
                  <Input value={form.tomador_nome} onChange={(e) => setForm({ ...form, tomador_nome: e.target.value })} />
                </div>
                <div>
                  <Label>CPF / CNPJ *</Label>
                  <Input value={form.tomador_documento} onChange={(e) => setForm({ ...form, tomador_documento: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Endereço</Label>
                  <Input value={form.tomador_endereco} onChange={(e) => setForm({ ...form, tomador_endereco: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input value={form.tomador_email} onChange={(e) => setForm({ ...form, tomador_email: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <h3 className="font-semibold mb-2">Serviço</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Código do Serviço</Label>
                  <Input value={form.codigo_servico} onChange={(e) => setForm({ ...form, codigo_servico: e.target.value })} placeholder="Ex: 9.02" />
                </div>
                <div>
                  <Label>Valor do Serviço (R$) *</Label>
                  <Input type="number" step="0.01" value={form.valor_servico} onChange={(e) => setForm({ ...form, valor_servico: e.target.value })} />
                </div>
                <div>
                  <Label>Alíquota ISS (%)</Label>
                  <Input type="number" step="0.01" value={form.aliquota_iss} onChange={(e) => setForm({ ...form, aliquota_iss: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <Label>Descrição do Serviço *</Label>
                  <Textarea rows={3} value={form.descricao_servico} onChange={(e) => setForm({ ...form, descricao_servico: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <Label>Observações</Label>
                  <Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Emitir Nota"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Digite a senha para excluir</Label>
            <Input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Nfse;
