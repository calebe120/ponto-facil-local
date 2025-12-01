import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Pencil, Trash2, Calendar, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";

interface TimeRecord {
  id: string;
  date: string;
  entry_time: string | null;
  lunch_exit_time: string | null;
  lunch_return_time: string | null;
  exit_time: string | null;
  employee_name: string;
  total_hours: string | null;
  user_id: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [employees, setEmployees] = useState<string[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TimeRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    date: "",
    entry_time: "",
    lunch_exit_time: "",
    lunch_return_time: "",
    exit_time: "",
  });
  const [manualEntryDialogOpen, setManualEntryDialogOpen] = useState(false);
  const [manualEntryData, setManualEntryData] = useState({
    employee_name: "",
    user_id: "",
    date: "",
    entry_time: "",
    lunch_exit_time: "",
    lunch_return_time: "",
    exit_time: "",
  });

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate("/auth");
        return;
      }

      if (role !== "admin") {
        toast({
          title: "Acesso Negado",
          description: "Você não tem permissão para acessar esta área.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      fetchRecords();
      setLoading(false);
    }
  }, [authLoading, user, role, navigate]);

  useEffect(() => {
    if (role === "admin") {
      fetchRecords();
    }
  }, [role]);

  const fetchRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("time_records")
        .select("*")
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
      
      const uniqueEmployees = Array.from(new Set(data?.map(r => r.employee_name) || []));
      setEmployees(uniqueEmployees);
    } catch (error) {
      console.error("Error fetching records:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os registros.",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const openEditDialog = (record: TimeRecord) => {
    setSelectedRecord(record);
    setEditFormData({
      date: record.date,
      entry_time: record.entry_time || "",
      lunch_exit_time: record.lunch_exit_time || "",
      lunch_return_time: record.lunch_return_time || "",
      exit_time: record.exit_time || "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedRecord) return;

    try {
      const { error } = await supabase
        .from("time_records")
        .update({
          date: editFormData.date,
          entry_time: editFormData.entry_time || null,
          lunch_exit_time: editFormData.lunch_exit_time || null,
          lunch_return_time: editFormData.lunch_return_time || null,
          exit_time: editFormData.exit_time || null,
        })
        .eq("id", selectedRecord.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro atualizado com sucesso.",
      });

      setEditDialogOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error updating record:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o registro.",
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (record: TimeRecord) => {
    setSelectedRecord(record);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedRecord) return;

    try {
      const { error } = await supabase
        .from("time_records")
        .delete()
        .eq("id", selectedRecord.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro excluído com sucesso.",
      });

      setDeleteDialogOpen(false);
      fetchRecords();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o registro.",
        variant: "destructive",
      });
    }
  };

  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const calculateTotalHours = (
    entryTime: string | null,
    lunchExitTime: string | null,
    lunchReturnTime: string | null,
    exitTime: string | null
  ): string => {
    if (!entryTime || !exitTime) {
      return "--:--";
    }

    const entrada = timeToMinutes(entryTime);
    const saida = timeToMinutes(exitTime);

    let totalMinutes = saida - entrada;

    if (lunchExitTime && lunchReturnTime) {
      const lunchExit = timeToMinutes(lunchExitTime);
      const lunchReturn = timeToMinutes(lunchReturnTime);
      const lunchBreakMinutes = lunchReturn - lunchExit;
      totalMinutes -= lunchBreakMinutes;
    } else {
      totalMinutes -= 60;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  };

  const openManualEntryDialog = () => {
    setManualEntryData({
      employee_name: "",
      user_id: "",
      date: new Date().toISOString().split("T")[0],
      entry_time: "",
      lunch_exit_time: "",
      lunch_return_time: "",
      exit_time: "",
    });
    setManualEntryDialogOpen(true);
  };

  const saveManualEntry = async () => {
    if (!manualEntryData.date || !manualEntryData.employee_name || !manualEntryData.user_id) {
      toast({
        title: "Erro",
        description: "Preencha o nome do funcionário, user_id e a data",
        variant: "destructive",
      });
      return;
    }

    if (!manualEntryData.entry_time && !manualEntryData.exit_time) {
      toast({
        title: "Erro",
        description: "Preencha pelo menos a entrada ou saída",
        variant: "destructive",
      });
      return;
    }

    try {
      const total = calculateTotalHours(
        manualEntryData.entry_time || null,
        manualEntryData.lunch_exit_time || null,
        manualEntryData.lunch_return_time || null,
        manualEntryData.exit_time || null
      );

      const { error } = await supabase
        .from("time_records")
        .insert({
          user_id: manualEntryData.user_id,
          employee_name: manualEntryData.employee_name,
          date: manualEntryData.date,
          entry_time: manualEntryData.entry_time || null,
          lunch_exit_time: manualEntryData.lunch_exit_time || null,
          lunch_return_time: manualEntryData.lunch_return_time || null,
          exit_time: manualEntryData.exit_time || null,
          total_hours: total,
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Registro manual adicionado com sucesso!",
      });
      setManualEntryDialogOpen(false);
      fetchRecords();
    } catch (error: any) {
      console.error("Error saving manual entry:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar registro manual",
        variant: "destructive",
      });
    }
  };

  const exportToXLS = () => {
    const filteredData = selectedEmployee === "all" 
      ? records 
      : records.filter(r => r.employee_name === selectedEmployee);

    const dataToExport = filteredData.map(record => ({
      "Funcionário": record.employee_name,
      "Data": new Date(record.date).toLocaleDateString("pt-BR"),
      "Entrada": record.entry_time || "-",
      "Saída Almoço": record.lunch_exit_time || "-",
      "Volta Almoço": record.lunch_return_time || "-",
      "Saída Final": record.exit_time || "-",
      "Total de Horas": record.total_hours || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Registros");
    
    const fileName = selectedEmployee === "all" 
      ? "registros_todos.xlsx" 
      : `registros_${selectedEmployee.replace(/\s+/g, "_")}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const filteredRecords = selectedEmployee === "all" 
    ? records 
    : records.filter(r => r.employee_name === selectedEmployee);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
            <p className="text-muted-foreground">Gerenciamento de registros de ponto</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/")}>
              Voltar
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros e Exportação</CardTitle>
            <CardDescription>Filtre por funcionário e exporte os dados</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="employee-filter">Funcionário</Label>
              <select
                id="employee-filter"
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
              >
                <option value="all">Todos os Funcionários</option>
                {employees.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={openManualEntryDialog} variant="default">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Registro Manual
              </Button>
              <Button onClick={exportToXLS} variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Exportar para Excel
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registros de Ponto</CardTitle>
            <CardDescription>
              {filteredRecords.length} registro(s) encontrado(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saída Almoço</TableHead>
                    <TableHead>Volta Almoço</TableHead>
                    <TableHead>Saída Final</TableHead>
                    <TableHead>Total Horas</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.employee_name}</TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{record.entry_time || "-"}</TableCell>
                      <TableCell>{record.lunch_exit_time || "-"}</TableCell>
                      <TableCell>{record.lunch_return_time || "-"}</TableCell>
                      <TableCell>{record.exit_time || "-"}</TableCell>
                      <TableCell>{record.total_hours || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(record)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(record)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredRecords.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>
              Funcionário: {selectedRecord?.employee_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-entry">Entrada</Label>
              <Input
                id="edit-entry"
                type="time"
                value={editFormData.entry_time}
                onChange={(e) => setEditFormData({ ...editFormData, entry_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-lunch-exit">Saída Almoço</Label>
              <Input
                id="edit-lunch-exit"
                type="time"
                value={editFormData.lunch_exit_time}
                onChange={(e) => setEditFormData({ ...editFormData, lunch_exit_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-lunch-return">Volta Almoço</Label>
              <Input
                id="edit-lunch-return"
                type="time"
                value={editFormData.lunch_return_time}
                onChange={(e) => setEditFormData({ ...editFormData, lunch_return_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-exit">Saída Final</Label>
              <Input
                id="edit-exit"
                type="time"
                value={editFormData.exit_time}
                onChange={(e) => setEditFormData({ ...editFormData, exit_time: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o registro de {selectedRecord?.employee_name} do dia{" "}
              {selectedRecord && new Date(selectedRecord.date).toLocaleDateString("pt-BR")}?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryDialogOpen} onOpenChange={setManualEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Registro Manual</DialogTitle>
            <DialogDescription>
              Preencha os dados do funcionário e os horários. Você pode registrar qualquer dia, inclusive dias anteriores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-employee-name">Nome do Funcionário *</Label>
              <Input
                id="manual-employee-name"
                type="text"
                placeholder="Nome completo"
                value={manualEntryData.employee_name}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, employee_name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-user-id">User ID *</Label>
              <Input
                id="manual-user-id"
                type="text"
                placeholder="ID do usuário no sistema"
                value={manualEntryData.user_id}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, user_id: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-date">Data *</Label>
              <Input
                id="manual-date"
                type="date"
                value={manualEntryData.date}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-entry">Entrada</Label>
              <Input
                id="manual-entry"
                type="time"
                value={manualEntryData.entry_time}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, entry_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-lunch-exit">Saída Almoço</Label>
              <Input
                id="manual-lunch-exit"
                type="time"
                value={manualEntryData.lunch_exit_time}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, lunch_exit_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-lunch-return">Volta Almoço</Label>
              <Input
                id="manual-lunch-return"
                type="time"
                value={manualEntryData.lunch_return_time}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, lunch_return_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-exit">Saída</Label>
              <Input
                id="manual-exit"
                type="time"
                value={manualEntryData.exit_time}
                onChange={(e) =>
                  setManualEntryData({ ...manualEntryData, exit_time: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualEntryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveManualEntry}>Salvar Registro</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;