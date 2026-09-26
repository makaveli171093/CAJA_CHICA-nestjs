import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Button,
  Table,
  Badge,
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Loader,
  Box,
  Pagination,
  Checkbox,
  Switch,
  Card,
  ActionIcon,
  Divider,
  Alert,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUserPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconPlus,
  IconAlertCircle,
  IconBuildingBank,
  IconId,
} from '@tabler/icons-react';
import { api } from '../../services/api';
import { User, Unit, Responsable } from '../../types';

interface DesignacionFormItem {
  unidadId: string;
  documentoDesignacion: string;
  fechaDesignacion: string;
  cargo?: string;
  responsableId?: string;
}

export const UsuariosPage: React.FC = () => {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [unlinkedResponsables, setUnlinkedResponsables] = useState<Responsable[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal Unificado
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form State
  const [form, setForm] = useState({
    username: '',
    nombres: '',
    apellidos: '',
    email: '',
    password: '',
    changePassword: false,
    rol: 'ENCARGADO' as 'ADMINISTRADOR' | 'ENCARGADO',
    activo: true,
    carnetIdentidad: '',
    cargo: 'Encargado de Caja Chica',
    designaciones: [] as DesignacionFormItem[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resUsers, resUnits, resUnlinked] = await Promise.all([
        api.get<{ items: User[]; total: number }>(
          `/usuarios?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
        ),
        api.get<{ items: Unit[] }>('/unidades?activo=true&limit=100'),
        api.get<{ items: Responsable[] }>('/responsables?desvinculados=true&limit=100'),
      ]);

      setUsuarios(resUsers.data.items);
      setTotal(resUsers.data.total);
      setUnidades(resUnits.data.items);
      setUnlinkedResponsables(resUnlinked.data.items);
    } catch (err: any) {
      notifications.show({
        title: 'Error de carga',
        message: err.response?.data?.message || 'Error al obtener usuarios.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, search]);

  const handleOpenCreate = () => {
    setIsEditing(false);
    setSelectedUser(null);
    setForm({
      username: '',
      nombres: '',
      apellidos: '',
      email: '',
      password: '',
      changePassword: true,
      rol: 'ENCARGADO',
      activo: true,
      carnetIdentidad: '',
      cargo: 'Encargado de Caja Chica',
      designaciones: unidades.length > 0
        ? [
            {
              unidadId: unidades[0].id,
              documentoDesignacion: '',
              fechaDesignacion: new Date().toISOString().split('T')[0],
              cargo: 'Encargado de Caja Chica',
            },
          ]
        : [],
    });
    openModal();
  };

  const handleOpenEdit = (user: User) => {
    setIsEditing(true);
    setSelectedUser(user);

    // Sugerencia de nombres/apellidos si no están separados aún
    let nombres = user.nombres || '';
    let apellidos = user.apellidos || '';
    if (!nombres && !apellidos && user.nombreCompleto) {
      const parts = user.nombreCompleto.trim().split(' ');
      if (parts.length > 1) {
        nombres = parts[0];
        apellidos = parts.slice(1).join(' ');
      } else {
        nombres = parts[0];
        apellidos = '';
      }
    }

    // Reconstruir designaciones existentes por cada unidad autorizada
    const designaciones: DesignacionFormItem[] = [];
    const assignedUnits = user.unidades || [];
    const userResps = user.responsables || [];

    for (const unit of assignedUnits) {
      const existingResp = userResps.find((r) => r.unidadId === unit.id);
      if (existingResp) {
        designaciones.push({
          unidadId: unit.id,
          documentoDesignacion: existingResp.documentoDesignacion || '',
          fechaDesignacion: existingResp.fechaDesignacion
            ? existingResp.fechaDesignacion.split('T')[0]
            : new Date().toISOString().split('T')[0],
          cargo: existingResp.cargo || user.cargo || 'Encargado de Caja Chica',
          responsableId: existingResp.id,
        });
      } else {
        designaciones.push({
          unidadId: unit.id,
          documentoDesignacion: '',
          fechaDesignacion: new Date().toISOString().split('T')[0],
          cargo: user.cargo || 'Encargado de Caja Chica',
        });
      }
    }

    setForm({
      username: user.username,
      nombres,
      apellidos,
      email: user.email || '',
      password: '',
      changePassword: false,
      rol: user.rol,
      activo: user.activo,
      carnetIdentidad: user.carnetIdentidad || '',
      cargo: user.cargo || 'Encargado de Caja Chica',
      designaciones,
    });
    openModal();
  };

  const handleAddDesignacion = () => {
    const existingUnitIds = new Set(form.designaciones.map((d) => d.unidadId));
    const availableUnit = unidades.find((u) => !existingUnitIds.has(u.id)) || unidades[0];

    if (!availableUnit) {
      notifications.show({
        title: 'Sin unidades disponibles',
        message: 'No existen más unidades institucionales activas para asignar.',
        color: 'yellow',
      });
      return;
    }

    setForm({
      ...form,
      designaciones: [
        ...form.designaciones,
        {
          unidadId: availableUnit.id,
          documentoDesignacion: '',
          fechaDesignacion: new Date().toISOString().split('T')[0],
          cargo: form.cargo || 'Encargado de Caja Chica',
        },
      ],
    });
  };

  const handleRemoveDesignacion = (index: number) => {
    const updated = [...form.designaciones];
    updated.splice(index, 1);
    setForm({ ...form, designaciones: updated });
  };

  const handleDesignacionChange = (index: number, field: keyof DesignacionFormItem, value: any) => {
    const updated = [...form.designaciones];
    updated[index] = { ...updated[index], [field]: value };
    setForm({ ...form, designaciones: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload: any = {
        username: form.username.trim(),
        nombres: form.nombres.trim(),
        apellidos: form.apellidos.trim(),
        nombreCompleto: `${form.nombres.trim()} ${form.apellidos.trim()}`.trim(),
        email: form.email.trim() || undefined,
        rol: form.rol,
        activo: form.activo,
      };

      if (!isEditing || form.changePassword) {
        if (!form.password) {
          throw new Error('Debe especificar la contraseña.');
        }
        payload.password = form.password;
      }

      if (form.rol === 'ENCARGADO') {
        if (!form.carnetIdentidad.trim()) {
          throw new Error('El carnet de identidad es obligatorio para un encargado.');
        }
        if (!form.cargo.trim()) {
          throw new Error('El cargo institucional es obligatorio para un encargado.');
        }
        if (form.designaciones.length === 0) {
          throw new Error('Debe asignar al menos una unidad institucional con su designación para el encargado.');
        }

        // Validar que no haya unidades duplicadas en la lista de designaciones
        const unitSet = new Set<string>();
        for (const d of form.designaciones) {
          if (!d.unidadId) throw new Error('Cada designación debe tener una unidad institucional seleccionada.');
          if (unitSet.has(d.unidadId)) {
            throw new Error('No puede asignar la misma unidad institucional más de una vez en el formulario.');
          }
          unitSet.add(d.unidadId);

          if (!d.documentoDesignacion.trim()) {
            throw new Error('Debe indicar la referencia del documento de designación formal para cada unidad asignada.');
          }
          if (!d.fechaDesignacion) {
            throw new Error('Debe indicar la fecha formal de designación para cada unidad asignada.');
          }
        }

        payload.carnetIdentidad = form.carnetIdentidad.trim();
        payload.cargo = form.cargo.trim();
        payload.designaciones = form.designaciones.map((d) => ({
          unidadId: d.unidadId,
          documentoDesignacion: d.documentoDesignacion.trim(),
          fechaDesignacion: d.fechaDesignacion,
          cargo: d.cargo?.trim() || form.cargo.trim(),
          responsableId: d.responsableId || undefined,
        }));
      }

      if (isEditing && selectedUser) {
        await api.patch(`/usuarios/${selectedUser.id}`, payload);
        notifications.show({
          title: 'Usuario Actualizado',
          message: `La información y designaciones de "${payload.username}" fueron actualizadas exitosamente.`,
          color: 'teal',
        });
      } else {
        await api.post('/usuarios', payload);
        notifications.show({
          title: 'Usuario Creado',
          message: `El usuario "${payload.username}" fue creado con su perfil y designación institucional.`,
          color: 'teal',
        });
      }

      closeModal();
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al guardar',
        message: err.response?.data?.message || err.message || 'No se pudo guardar la información del usuario.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActivo = async (user: User) => {
    try {
      await api.patch(`/usuarios/${user.id}`, { activo: !user.activo });
      notifications.show({
        title: user.activo ? 'Usuario Desactivado' : 'Usuario Activado',
        message: `El usuario "${user.username}" fue ${user.activo ? 'desactivado' : 'activado'}.`,
        color: 'teal',
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.response?.data?.message || 'Error al cambiar estado.',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group justify="space-between">
          <Box>
            <Title order={3} c="#1e293b">
              Gestión Unificada de Usuarios y Responsables
            </Title>
            <Text size="xs" c="dimmed">
              Registro integral de cuentas de acceso, datos personales y designaciones por unidad de caja chica
            </Text>
          </Box>
          <Button color="cpsTeal" leftSection={<IconUserPlus size={16} />} onClick={handleOpenCreate}>
            Nuevo Funcionario
          </Button>
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group mb="md">
          <TextInput
            placeholder="Buscar por usuario, nombre, carnet o correo..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(1);
            }}
            style={{ width: 380 }}
          />
        </Group>

        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : usuarios.length > 0 ? (
          <>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th>Usuario</Table.Th>
                  <Table.Th>Funcionario / Carnet</Table.Th>
                  <Table.Th>Rol / Cargo</Table.Th>
                  <Table.Th>Unidades y Designaciones</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {usuarios.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td style={{ fontWeight: 600 }}>{u.username}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={600} c="#1e293b">
                        {u.nombreCompleto}
                      </Text>
                      {u.carnetIdentidad && (
                        <Text size="xs" c="dimmed">
                          CI: {u.carnetIdentidad}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={u.rol === 'ADMINISTRADOR' ? 'blue' : 'teal'} variant="light" mb={4}>
                        {u.rol}
                      </Badge>
                      {u.cargo && (
                        <Text size="xs" c="dimmed">
                          {u.cargo}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {u.rol === 'ADMINISTRADOR' ? (
                        <Text size="xs" c="dimmed">
                          Acceso Global a todas las unidades
                        </Text>
                      ) : (
                        <Stack gap={4}>
                          {u.unidades && u.unidades.length > 0 ? (
                            u.unidades.map((unit) => {
                              const desig = u.responsables?.find((r) => r.unidadId === unit.id);
                              return (
                                <Group key={unit.id} gap={6}>
                                  <Badge size="xs" color="gray" variant="outline">
                                    {unit.codigo}
                                  </Badge>
                                  <Text size="xs" c="#334155">
                                    {unit.nombre}
                                  </Text>
                                  {desig?.documentoDesignacion ? (
                                    <Badge size="xs" color="teal" variant="light">
                                      {desig.documentoDesignacion}
                                    </Badge>
                                  ) : (
                                    <Badge size="xs" color="yellow" variant="light">
                                      Sin designación
                                    </Badge>
                                  )}
                                </Group>
                              );
                            })
                          ) : (
                            <Text size="xs" c="dimmed">
                              Sin unidades asignadas
                            </Text>
                          )}
                        </Stack>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={u.activo ? 'teal' : 'red'} variant="dot">
                        {u.activo ? 'ACTIVO' : 'DESACTIVADO'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap={6} justify="center">
                        <Button
                          size="xs"
                          variant="light"
                          color="cpsTeal"
                          leftSection={<IconEdit size={14} />}
                          onClick={() => handleOpenEdit(u)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color={u.activo ? 'red' : 'green'}
                          onClick={() => handleToggleActivo(u)}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="center" mt="md">
              <Pagination total={Math.ceil(total / 10) || 1} value={page} onChange={setPage} color="cpsTeal" />
            </Group>
          </>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No se encontraron usuarios ni encargados registrados.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal Unificado de Creación y Edición */}
      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title={
          <Group gap="xs">
            <IconId size={20} color="#007B6D" />
            <Text fw={700} size="md">
              {isEditing ? `Editar Funcionario: ${form.username}` : 'Registrar Nuevo Funcionario'}
            </Text>
          </Group>
        }
        centered
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            {/* Sección 1: Datos de Acceso */}
            <Title order={5} c="#007B6D">
              1. Identificación y Acceso al Sistema
            </Title>

            <Group grow>
              <TextInput
                label="Nombre de Usuario (Acceso)"
                placeholder="ej. jlinares"
                required
                disabled={isEditing}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.currentTarget.value })}
              />
              <TextInput
                label="Correo Electrónico (Opcional)"
                placeholder="ej. jlinares@cps.org.bo"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.currentTarget.value })}
              />
            </Group>

            <Group grow>
              <TextInput
                label="Nombres"
                placeholder="ej. Jared Angel"
                required
                value={form.nombres}
                onChange={(e) => setForm({ ...form, nombres: e.currentTarget.value })}
              />
              <TextInput
                label="Apellidos"
                placeholder="ej. Linares Quispe"
                required
                value={form.apellidos}
                onChange={(e) => setForm({ ...form, apellidos: e.currentTarget.value })}
              />
            </Group>

            <Group grow align="flex-end">
              <Select
                label="Rol Institucional"
                data={[
                  { value: 'ENCARGADO', label: 'ENCARGADO (Opera caja chica en sus unidades asignadas)' },
                  { value: 'ADMINISTRADOR', label: 'ADMINISTRADOR (Gestión global del sistema)' },
                ]}
                value={form.rol}
                onChange={(val) => setForm({ ...form, rol: (val as any) || 'ENCARGADO' })}
                required
              />
              <Switch
                label="Usuario Activo"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.currentTarget.checked })}
                color="teal"
                mb={8}
              />
            </Group>

            {/* Contraseña */}
            {isEditing ? (
              <Box p="xs" style={{ backgroundColor: '#f8fafc', borderRadius: 8 }}>
                <Checkbox
                  label="Modificar contraseña de acceso"
                  checked={form.changePassword}
                  onChange={(e) => setForm({ ...form, changePassword: e.currentTarget.checked })}
                  color="cpsTeal"
                  mb={form.changePassword ? 'xs' : 0}
                />
                {form.changePassword && (
                  <PasswordInput
                    label="Nueva Contraseña"
                    placeholder="Mínimo 6 caracteres"
                    required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
                  />
                )}
              </Box>
            ) : (
              <PasswordInput
                label="Contraseña Inicial de Acceso"
                placeholder="Mínimo 6 caracteres"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.currentTarget.value })}
              />
            )}

            {/* Sección 2: Perfil de Responsable de Caja (Solo si es ENCARGADO) */}
            {form.rol === 'ENCARGADO' && (
              <>
                <Divider my="xs" />
                <Title order={5} c="#007B6D">
                  2. Perfil y Designaciones de Caja Chica
                </Title>

                <Group grow>
                  <TextInput
                    label="Carnet de Identidad"
                    placeholder="ej. 6854125 LP"
                    required
                    value={form.carnetIdentidad}
                    onChange={(e) => setForm({ ...form, carnetIdentidad: e.currentTarget.value })}
                  />
                  <TextInput
                    label="Cargo Institucional"
                    placeholder="ej. Encargado de Caja Chica"
                    required
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.currentTarget.value })}
                  />
                </Group>

                <Group justify="space-between" mt="xs">
                  <Text size="sm" fw={600} c="#334155">
                    Unidades Asignadas y Documentos de Designación:
                  </Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="cpsTeal"
                    leftSection={<IconPlus size={14} />}
                    onClick={handleAddDesignacion}
                  >
                    Asignar otra unidad
                  </Button>
                </Group>

                {form.designaciones.length === 0 ? (
                  <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                    Debe asignar al menos una unidad institucional para el encargado.
                  </Alert>
                ) : (
                  <Stack gap="xs">
                    {form.designaciones.map((desig, idx) => {
                      // Opciones de fichas desvinculadas para esta unidad
                      const unlinkedForUnit = unlinkedResponsables.filter(
                        (ur) => ur.unidadId === desig.unidadId,
                      );

                      return (
                        <Card key={idx} withBorder p="sm" radius="md" style={{ backgroundColor: '#f8fafc' }}>
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Group gap="xs">
                                <IconBuildingBank size={18} color="#007B6D" />
                                <Text size="sm" fw={600} c="#1e293b">
                                  Unidad #{idx + 1}
                                </Text>
                              </Group>
                              {form.designaciones.length > 1 && (
                                <ActionIcon
                                  color="red"
                                  variant="subtle"
                                  size="sm"
                                  onClick={() => handleRemoveDesignacion(idx)}
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              )}
                            </Group>

                            <Select
                              label="Unidad Institucional"
                              placeholder="Seleccione la unidad"
                              required
                              data={unidades.map((u) => ({
                                value: u.id,
                                label: `${u.codigo} - ${u.nombre}`,
                              }))}
                              value={desig.unidadId}
                              onChange={(val) => handleDesignacionChange(idx, 'unidadId', val || '')}
                            />

                            {unlinkedForUnit.length > 0 && (
                              <Select
                                label="Vincular con Ficha de Responsable Preexistente (Opcional)"
                                placeholder="Seleccionar ficha previa sin cuenta vinculada..."
                                clearable
                                data={unlinkedForUnit.map((ur) => ({
                                  value: ur.id,
                                  label: `${ur.nombres} ${ur.apellidos} - Memo: ${ur.documentoDesignacion} (${new Date(ur.fechaDesignacion).toLocaleDateString('es-BO')})`,
                                }))}
                                value={desig.responsableId || null}
                                onChange={(val) => {
                                  const linkedResp = unlinkedForUnit.find((ur) => ur.id === val);
                                  if (linkedResp) {
                                    handleDesignacionChange(idx, 'responsableId', linkedResp.id);
                                    handleDesignacionChange(idx, 'documentoDesignacion', linkedResp.documentoDesignacion);
                                    handleDesignacionChange(
                                      idx,
                                      'fechaDesignacion',
                                      linkedResp.fechaDesignacion.split('T')[0],
                                    );
                                  } else {
                                    handleDesignacionChange(idx, 'responsableId', undefined);
                                  }
                                }}
                              />
                            )}

                            <Group grow>
                              <TextInput
                                label="Referencia Documento Designación"
                                placeholder="ej. Memo RRHH N° 045/2026"
                                required
                                value={desig.documentoDesignacion}
                                onChange={(e) =>
                                  handleDesignacionChange(idx, 'documentoDesignacion', e.currentTarget.value)
                                }
                              />
                              <TextInput
                                label="Fecha Formal de Designación"
                                type="date"
                                required
                                value={desig.fechaDesignacion}
                                onChange={(e) =>
                                  handleDesignacionChange(idx, 'fechaDesignacion', e.currentTarget.value)
                                }
                              />
                            </Group>
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                )}
              </>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeModal} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                {isEditing ? 'Guardar Cambios' : 'Crear Funcionario'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
