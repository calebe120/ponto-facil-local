import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Clock, Users, Download, Trash2, Calendar, Edit } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import logoCvc from "@/assets/logo-cvc.jpeg";

interface TimeRecord {
  id: string;
  employeeName: string;
  date: string;
  entrada?: string;
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida?: string;
  totalHoras?: string;
  horasExtras?: boolean;
}

const Index = () => {
  const [employees, setEmployees] = useState<string[]>([]);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [editingRecord, setEditingRecord] = useState<TimeRecord | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editPassword, setEditPassword] = useState("");
  const [editFormData, setEditFormData] = useState({
    entrada: "",
    saidaAlmoco: "",
    retornoAlmoco: "",
    saida: "",
  });
  const [clearPassword, setClearPassword] = useState("");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [periodStartDate, setPeriodStartDate] = useState("");
  const [periodEndDate, setPeriodEndDate] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [recordToDelete, setRecordToDelete] = useState<TimeRecord | null>(null);

  // Load data from localStorage
  useEffect(() => {
    const savedEmployees = localStorage.getItem("employees");
    const savedRecords = localStorage.getItem("timeRecords");
    if (savedEmployees) setEmployees(JSON.parse(savedEmployees));
    if (savedRecords) setRecords(JSON.parse(savedRecords));
  }, []);

  // Save employees to localStorage
  useEffect(() => {
    localStorage.setItem("employees", JSON.stringify(employees));
  }, [employees]);

  // Save records to localStorage
  useEffect(() => {
    localStorage.setItem("timeRecords", JSON.stringify(records));
  }, [records]);

  const addEmployee = () => {
    if (!newEmployeeName.trim()) {
      toast.error("Digite o nome do funcionário");
      return;
    }
    if (employees.includes(newEmployeeName.trim())) {
      toast.error("Funcionário já cadastrado");
      return;
    }
    setEmployees([...employees, newEmployeeName.trim()]);
    setNewEmployeeName("");
    toast.success("Funcionário adicionado com sucesso!");
  };

  const removeEmployee = (name: string) => {
    setEmployees(employees.filter((e) => e !== name));
    toast.success("Funcionário removido");
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  };

  const calculateTotalHours = (record: TimeRecord): { total: string; overtime: boolean } => {
    if (!record.entrada || !record.saida) {
      return { total: "--:--", overtime: false };
    }

    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const entrada = timeToMinutes(record.entrada);
    const saida = timeToMinutes(record.saida);
    
    let totalMinutes = saida - entrada;
    
    // Subtract lunch break (1 hour = 60 minutes)
    if (record.saidaAlmoco && record.retornoAlmoco) {
      const saidaAlmoco = timeToMinutes(record.saidaAlmoco);
      const retornoAlmoco = timeToMinutes(record.retornoAlmoco);
      const lunchMinutes = retornoAlmoco - saidaAlmoco;
      totalMinutes -= lunchMinutes;
    } else {
      totalMinutes -= 60; // Default 1 hour lunch
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    const overtime = totalMinutes > 480; // 8 hours = 480 minutes

    return {
      total: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      overtime,
    };
  };

  const markTime = (employeeName: string, type: "entrada" | "saidaAlmoco" | "retornoAlmoco" | "saida") => {
    const today = filterDate || new Date().toISOString().split("T")[0];
    const currentTime = getCurrentTime();
    
    const existingRecordIndex = records.findIndex(
      (r) => r.employeeName === employeeName && r.date === today
    );

    let updatedRecords = [...records];

    if (existingRecordIndex >= 0) {
      updatedRecords[existingRecordIndex] = {
        ...updatedRecords[existingRecordIndex],
        [type]: currentTime,
      };
    } else {
      const newRecord: TimeRecord = {
        id: `${employeeName}-${today}-${Date.now()}`,
        employeeName,
        date: today,
        [type]: currentTime,
      };
      updatedRecords = [newRecord, ...updatedRecords];
    }

    // Calculate total hours
    const record = updatedRecords[existingRecordIndex >= 0 ? existingRecordIndex : 0];
    const { total, overtime } = calculateTotalHours(record);
    record.totalHoras = total;
    record.horasExtras = overtime;

    setRecords(updatedRecords);
    
    const typeLabels = {
      entrada: "Entrada",
      saidaAlmoco: "Saída para Almoço",
      retornoAlmoco: "Retorno do Almoço",
      saida: "Saída",
    };
    
    toast.success(`${typeLabels[type]} registrada: ${currentTime}`);
  };

  const exportToXLS = () => {
    const filteredRecords = filterDate
      ? records.filter((r) => r.date === filterDate)
      : records;

    if (filteredRecords.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }

    const data = filteredRecords.map((r) => ({
      Data: new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR"),
      Funcionário: r.employeeName,
      Entrada: r.entrada || "--:--",
      "Saída Almoço": r.saidaAlmoco || "--:--",
      "Retorno Almoço": r.retornoAlmoco || "--:--",
      Saída: r.saida || "--:--",
      "Total Horas": r.totalHoras || "--:--",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    
    XLSX.writeFile(workbook, `registros-ponto-${filterDate || "todos"}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  const exportCurrentMonth = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];

    const monthRecords = records.filter((r) => r.date >= firstDay && r.date <= lastDay);

    if (monthRecords.length === 0) {
      toast.error("Nenhum registro encontrado para o mês atual");
      return;
    }

    const data = monthRecords.map((r) => ({
      Data: new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR"),
      Funcionário: r.employeeName,
      Entrada: r.entrada || "--:--",
      "Saída Almoço": r.saidaAlmoco || "--:--",
      "Retorno Almoço": r.retornoAlmoco || "--:--",
      Saída: r.saida || "--:--",
      "Total Horas": r.totalHoras || "--:--",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    
    const monthName = today.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    XLSX.writeFile(workbook, `registros-ponto-${monthName}.xlsx`);
    toast.success("Excel do mês exportado com sucesso!");
  };

  const openPeriodDialog = () => {
    setPeriodStartDate("");
    setPeriodEndDate("");
    setPeriodDialogOpen(true);
  };

  const exportPeriod = () => {
    if (!periodStartDate || !periodEndDate) {
      toast.error("Selecione as datas inicial e final");
      return;
    }

    if (periodStartDate > periodEndDate) {
      toast.error("Data inicial não pode ser maior que a data final");
      return;
    }

    const periodRecords = records.filter(
      (r) => r.date >= periodStartDate && r.date <= periodEndDate
    );

    if (periodRecords.length === 0) {
      toast.error("Nenhum registro encontrado para o período selecionado");
      return;
    }

    const data = periodRecords.map((r) => ({
      Data: new Date(r.date + "T00:00:00").toLocaleDateString("pt-BR"),
      Funcionário: r.employeeName,
      Entrada: r.entrada || "--:--",
      "Saída Almoço": r.saidaAlmoco || "--:--",
      "Retorno Almoço": r.retornoAlmoco || "--:--",
      Saída: r.saida || "--:--",
      "Total Horas": r.totalHoras || "--:--",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registros");
    
    XLSX.writeFile(workbook, `registros-ponto-${periodStartDate}_${periodEndDate}.xlsx`);
    toast.success("Excel do período exportado com sucesso!");
    setPeriodDialogOpen(false);
  };

  const openClearDialog = () => {
    setClearDialogOpen(true);
    setClearPassword("");
  };

  const clearAllData = () => {
    if (clearPassword !== "3255") {
      toast.error("Senha incorreta");
      return;
    }
    setEmployees([]);
    setRecords([]);
    localStorage.removeItem("employees");
    localStorage.removeItem("timeRecords");
    toast.success("Todos os dados foram limpos");
    setClearDialogOpen(false);
    setClearPassword("");
  };

  const openEditDialog = (record: TimeRecord) => {
    setEditingRecord(record);
    setEditFormData({
      entrada: record.entrada || "",
      saidaAlmoco: record.saidaAlmoco || "",
      retornoAlmoco: record.retornoAlmoco || "",
      saida: record.saida || "",
    });
    setEditPassword("");
    setEditDialogOpen(true);
  };

  const saveEditedRecord = () => {
    if (editPassword !== "3255") {
      toast.error("Senha incorreta");
      return;
    }

    if (!editingRecord) return;

    const updatedRecords = records.map((r) => {
      if (r.id === editingRecord.id) {
        const updatedRecord = {
          ...r,
          entrada: editFormData.entrada,
          saidaAlmoco: editFormData.saidaAlmoco,
          retornoAlmoco: editFormData.retornoAlmoco,
          saida: editFormData.saida,
        };
        
        const { total, overtime } = calculateTotalHours(updatedRecord);
        updatedRecord.totalHoras = total;
        updatedRecord.horasExtras = overtime;
        
        return updatedRecord;
      }
      return r;
    });

    setRecords(updatedRecords);
    setEditDialogOpen(false);
    setEditingRecord(null);
    setEditPassword("");
    toast.success("Registro atualizado com sucesso!");
  };

  const openDeleteDialog = (record: TimeRecord) => {
    setRecordToDelete(record);
    setDeletePassword("");
    setDeleteDialogOpen(true);
  };

  const deleteRecord = () => {
    if (deletePassword !== "3255") {
      toast.error("Senha incorreta. Ação cancelada.");
      return;
    }

    if (!recordToDelete) return;

    const updatedRecords = records.filter((r) => r.id !== recordToDelete.id);
    setRecords(updatedRecords);
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
    setDeletePassword("");
    toast.success("Registro apagado com sucesso!");
  };

  // Filter records by month instead of specific date
  const getMonthRecords = () => {
    if (!filterDate) return records;
    
    const selectedDate = new Date(filterDate + "T00:00:00");
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split("T")[0];
    
    return records
      .filter((r) => r.date >= firstDay && r.date <= lastDay)
      .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically
  };

  const filteredRecords = getMonthRecords();

  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedMonthName = filterDate 
    ? new Date(filterDate + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    : "Todos os registros";

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <img src={logoCvc} alt="CVC Logo" className="w-24 h-24 object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-foreground flex items-center justify-center gap-3">
            <Clock className="w-10 h-10 text-accent" />
            Sistema de Controle de Ponto
          </h1>
          <p className="text-muted-foreground capitalize">{currentDate}</p>
        </div>

        {/* Employee Registration */}
        <Card className="p-6 shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Users className="w-6 h-6 text-success" />
            Cadastro de Funcionários
          </h2>
          <div className="flex gap-3">
            <Input
              type="text"
              placeholder="Digite o nome do funcionário"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addEmployee()}
              className="flex-1"
            />
            <Button onClick={addEmployee} className="bg-success hover:bg-success/90">
              Adicionar
            </Button>
          </div>
        </Card>

        {/* Time Marking */}
        {employees.length > 0 && (
          <Card className="p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4">Marcação de Ponto</h2>
            <div className="space-y-4">
              {employees.map((emp) => (
                <div
                  key={emp}
                  className="flex flex-wrap items-center gap-3 p-4 bg-muted rounded-lg"
                >
                  <span className="font-medium text-foreground flex-1 min-w-[150px]">
                    {emp}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => markTime(emp, "entrada")}
                      size="sm"
                      className="bg-success hover:bg-success/90"
                    >
                      Entrada
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "saidaAlmoco")}
                      size="sm"
                      className="bg-warning hover:bg-warning/90"
                    >
                      Saída Almoço
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "retornoAlmoco")}
                      size="sm"
                      className="bg-info hover:bg-info/90"
                    >
                      Retorno Almoço
                    </Button>
                    <Button
                      onClick={() => markTime(emp, "saida")}
                      size="sm"
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Saída
                    </Button>
                    <Button
                      onClick={() => removeEmployee(emp)}
                      size="sm"
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Records Table */}
        <Card className="p-6 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-semibold">Registros de Ponto</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Visualizando: {selectedMonthName}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-auto"
                  title="Selecione qualquer dia para ver o mês inteiro"
                />
              </div>
              <Button onClick={exportToXLS} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Dia
              </Button>
              <Button onClick={exportCurrentMonth} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Mês Atual
              </Button>
              <Button onClick={openPeriodDialog} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar Período
              </Button>
              <Button
                onClick={openClearDialog}
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar Tudo
              </Button>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum registro encontrado para este mês
            </p>
          ) : (
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-border rounded-md">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold">Data</th>
                    <th className="text-left p-3 font-semibold">Funcionário</th>
                    <th className="text-left p-3 font-semibold">Entrada</th>
                    <th className="text-left p-3 font-semibold">Saída Almoço</th>
                    <th className="text-left p-3 font-semibold">Retorno</th>
                    <th className="text-left p-3 font-semibold">Saída</th>
                    <th className="text-left p-3 font-semibold">Total Horas</th>
                    <th className="text-left p-3 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border hover:bg-muted/50">
                      <td className="p-3">
                        {new Date(record.date + "T00:00:00").toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 font-medium">{record.employeeName}</td>
                      <td className="p-3">{record.entrada || "--:--"}</td>
                      <td className="p-3">{record.saidaAlmoco || "--:--"}</td>
                      <td className="p-3">{record.retornoAlmoco || "--:--"}</td>
                      <td className="p-3">{record.saida || "--:--"}</td>
                      <td className="p-3">
                        <span
                          className={`font-semibold ${
                            record.horasExtras
                              ? "text-overtime"
                              : "text-success"
                          }`}
                        >
                          {record.totalHoras || "--:--"}
                          {record.horasExtras && " ⚠️"}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button
                            onClick={() => openEditDialog(record)}
                            size="sm"
                            variant="outline"
                            className="border-info text-info hover:bg-info hover:text-info-foreground"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => openDeleteDialog(record)}
                            size="sm"
                            variant="outline"
                            className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Registro</DialogTitle>
              <DialogDescription>
                Funcionário: {editingRecord?.employeeName} - Data:{" "}
                {editingRecord?.date && new Date(editingRecord.date + "T00:00:00").toLocaleDateString("pt-BR")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-entrada">Entrada</Label>
                <Input
                  id="edit-entrada"
                  type="time"
                  value={editFormData.entrada}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, entrada: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-saida-almoco">Saída Almoço</Label>
                <Input
                  id="edit-saida-almoco"
                  type="time"
                  value={editFormData.saidaAlmoco}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, saidaAlmoco: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retorno-almoco">Retorno Almoço</Label>
                <Input
                  id="edit-retorno-almoco"
                  type="time"
                  value={editFormData.retornoAlmoco}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, retornoAlmoco: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-saida">Saída</Label>
                <Input
                  id="edit-saida"
                  type="time"
                  value={editFormData.saida}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, saida: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Senha</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={saveEditedRecord} className="bg-success hover:bg-success/90">
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Period Export Dialog */}
        <Dialog open={periodDialogOpen} onOpenChange={setPeriodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exportar Período</DialogTitle>
              <DialogDescription>
                Selecione a data inicial e final para exportar os registros
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Data Inicial</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStartDate}
                  onChange={(e) => setPeriodStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Data Final</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEndDate}
                  onChange={(e) => setPeriodEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPeriodDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={exportPeriod} className="bg-success hover:bg-success/90">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Record Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apagar Registro</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja apagar este registro? Esta ação não pode ser desfeita.
                {recordToDelete && (
                  <div className="mt-2 text-foreground">
                    <p><strong>Funcionário:</strong> {recordToDelete.employeeName}</p>
                    <p><strong>Data:</strong> {new Date(recordToDelete.date + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="delete-password">Digite a senha para confirmar</Label>
                <Input
                  id="delete-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && deleteRecord()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={deleteRecord} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Apagar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Data Dialog */}
        <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Limpar Todos os Dados</DialogTitle>
              <DialogDescription>
                Esta ação irá remover todos os funcionários e registros. Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="clear-password">Digite a senha para confirmar</Label>
                <Input
                  id="clear-password"
                  type="password"
                  placeholder="Digite a senha"
                  value={clearPassword}
                  onChange={(e) => setClearPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={clearAllData} variant="destructive">
                Limpar Tudo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Index;
