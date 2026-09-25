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
  MultiSelect,
  Loader,
  Box,
  Pagination,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconUserPlus, IconSearch, IconBuilding, IconLock, IconShield } from '@tabler/icons-react';
import { api } from '../../services/api';
import { User, Unit } from '../../types';

export const UsuariosPage: React.FC = () => {
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modals
  const [createOpened, { open: openCreate, close: closeCreate }] = useDisclosure(false);
  const [assignOpened, { open: openAssign, close: closeAssign }] = useDisclosure(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    nombreCompleto: '',
    email: '',
    password: '',
    rol: 'ENCARGADO',
    unidades: [] as string[],
  });

  const [assignedUnitIds, setAssignedUnitIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resUsers, resUnits] = await Promise.all([
        api.get<{ items: User[]; total: number }>(
          `/usuarios?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
        ),
        api.get<{ items: Unit[] }>('/unidades?activo=true&limit=100'),
      ]);

      setUsuarios(resUsers.data.items);
      setTotal(resUsers.data.total);
      setUnidades(resUnits.data.items);
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/usuarios', createForm);
      notifications.show({
        title: 'Usuario Creado',
        message: 'El nuevo usuario institucional fue registrado exitosamente.',
        color: 'teal',
      });
      closeCreate();
      setCreateForm({
        username: '',
        nombreCompleto: '',
        email: '',
        password: '',
        rol: 'ENCARGADO',
        unidades: [],
      });
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al crear usuario',
        message: err.response?.data?.message || 'No se pudo crear el usuario.',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignUnits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSubmitting(true);
    try {
      await api.post(`/usuarios/${selectedUser.id}/unidades`, {
        unitIds: assignedUnitIds,
      });
      notifications.show({
        title: 'Unidades Asignadas',
        message: 'Se actualizaron las unidades autorizadas para el usuario.',
        color: 'teal',
      });
      closeAssign();
      fetchData();
    } catch (err: any) {
      notifications.show({
        title: 'Error al asignar unidades',
        message: err.response?.data?.message || 'No se pudo guardar la asignación.',
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
              Gestión de Usuarios y Asignación de Unidades
            </Title>
            <Text size="xs" c="dimmed">
              Control de acceso basado en roles institucionales y aislamiento por unidad
            </Text>
          </Box>
          <Button color="cpsTeal" leftSection={<IconUserPlus size={16} />} onClick={openCreate}>
            Nuevo Usuario
          </Button>
        </Group>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group mb="md">
          <TextInput
            placeholder="Buscar por usuario, nombre o correo..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => {
              setSearch(e.currentTarget.value);
              setPage(1);
            }}
            style={{ width: 350 }}
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
                  <Table.Th>Nombre Completo</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Unidades Autorizadas</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th style={{ textAlign: 'center' }}>Acciones</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {usuarios.map((u) => (
                  <Table.Tr key={u.id}>
                    <Table.Td style={{ fontWeight: 600 }}>{u.username}</Table.Td>
                    <Table.Td>{u.nombreCompleto}</Table.Td>
                    <Table.Td>
                      <Badge color={u.rol === 'ADMINISTRADOR' ? 'blue' : 'teal'} variant="light">
                        {u.rol}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {u.rol === 'ADMINISTRADOR' ? (
                        <Text size="xs" c="dimmed">
                          Acceso Global a todas las unidades
                        </Text>
                      ) : (
                        <Group gap={4}>
                          <Badge color="gray" variant="outline">
                            {u.unidades?.length || 0} unidades
                          </Badge>
                          <Button
                            size="xs"
                            variant="subtle"
                            color="cpsTeal"
                            onClick={() => {
                              setSelectedUser(u);
                              setAssignedUnitIds(u.unidades?.map((x) => x.id) || []);
                              openAssign();
                            }}
                          >
                            Asignar
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={u.activo ? 'teal' : 'red'} variant="dot">
                        {u.activo ? 'ACTIVO' : 'DESACTIVADO'}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Button
                        size="xs"
                        variant="subtle"
                        color={u.activo ? 'red' : 'green'}
                        onClick={() => handleToggleActivo(u)}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </Button>
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
            <Text c="dimmed">No se encontraron usuarios.</Text>
          </Box>
        )}
      </Paper>

      {/* Modal: Crear Usuario */}
      <Modal opened={createOpened} onClose={closeCreate} title="Registrar Nuevo Usuario" centered size="md">
        <form onSubmit={handleCreate}>
          <Stack gap="md">
            <TextInput
              label="Nombre de Usuario (Acceso)"
              placeholder="ej. jlinares"
              required
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.currentTarget.value })}
            />

            <TextInput
              label="Nombre Completo del Funcionario"
              placeholder="ej. Jared Linares"
              required
              value={createForm.nombreCompleto}
              onChange={(e) => setCreateForm({ ...createForm, nombreCompleto: e.currentTarget.value })}
            />

            <TextInput
              label="Correo Electrónico (Opcional)"
              placeholder="ej. jlinares@cps.org.bo"
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.currentTarget.value })}
            />

            <PasswordInput
              label="Contraseña Inicial"
              placeholder="Mínimo 6 caracteres"
              required
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.currentTarget.value })}
            />

            <Select
              label="Rol en el Sistema"
              data={[
                { value: 'ENCARGADO', label: 'ENCARGADO (Opera en sus unidades asignadas)' },
                { value: 'ADMINISTRADOR', label: 'ADMINISTRADOR (Gestión global de catálogos y usuarios)' },
              ]}
              value={createForm.rol}
              onChange={(val) => setCreateForm({ ...createForm, rol: val || 'ENCARGADO' })}
              required
            />

            {createForm.rol === 'ENCARGADO' && (
              <MultiSelect
                label="Unidades Autorizadas Iniciales"
                placeholder="Seleccione una o varias unidades"
                data={unidades.map((u) => ({
                  value: u.id,
                  label: `${u.codigo} - ${u.nombre}`,
                }))}
                value={createForm.unidades}
                onChange={(vals) => setCreateForm({ ...createForm, unidades: vals })}
              />
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeCreate} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Crear Usuario
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal: Asignar Unidades a Usuario */}
      <Modal
        opened={assignOpened}
        onClose={closeAssign}
        title={`Asignar Unidades: ${selectedUser?.nombreCompleto} (${selectedUser?.username})`}
        centered
        size="md"
      >
        <form onSubmit={handleAssignUnits}>
          <Stack gap="md">
            <Text size="xs" c="dimmed">
              El usuario únicamente podrá visualizar y operar sobre las unidades seleccionadas aquí.
            </Text>

            <MultiSelect
              label="Unidades Institucionales Autorizadas"
              placeholder="Seleccione las unidades a asignar"
              data={unidades.map((u) => ({
                value: u.id,
                label: `${u.codigo} - ${u.nombre}`,
              }))}
              value={assignedUnitIds}
              onChange={setAssignedUnitIds}
              searchable
              clearable
            />

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={closeAssign} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" color="cpsTeal" loading={isSubmitting}>
                Guardar Unidades Asignadas
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
};
