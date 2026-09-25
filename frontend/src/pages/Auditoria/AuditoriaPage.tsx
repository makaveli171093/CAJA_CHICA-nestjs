import React, { useEffect, useState } from 'react';
import {
  Title,
  Text,
  Paper,
  Stack,
  Group,
  Table,
  Badge,
  TextInput,
  Loader,
  Box,
  Pagination,
  Code,
} from '@mantine/core';
import { IconSearch, IconHistory } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { api } from '../../services/api';

interface AuditItem {
  id: string;
  actorUsername: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalleJson?: string;
  ipAddress?: string;
  fecha: string;
}

export const AuditoriaPage: React.FC = () => {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchAccion, setSearchAccion] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ items: AuditItem[]; total: number }>(
        `/auditoria?page=${page}&limit=15&accion=${encodeURIComponent(searchAccion)}`,
      );
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch (err: any) {
      notifications.show({
        title: 'Error de auditoría',
        message: err.response?.data?.message || 'No se pudieron consultar los registros de auditoría.',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [page, searchAccion]);

  return (
    <Stack gap="lg">
      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Box>
          <Title order={3} c="#1e293b">
            Bitácora de Auditoría y Trazabilidad Institucional
          </Title>
          <Text size="xs" c="dimmed">
            Registro cronológico inmutable de actores, operaciones y modificaciones en el sistema (Normativa 10 años)
          </Text>
        </Box>
      </Paper>

      <Paper p="md" radius="md" withBorder style={{ backgroundColor: '#ffffff' }}>
        <Group mb="md">
          <TextInput
            placeholder="Filtrar por acción (ej. LOGIN, APERTURA, PRESUPUESTO)..."
            leftSection={<IconSearch size={16} />}
            value={searchAccion}
            onChange={(e) => {
              setSearchAccion(e.currentTarget.value);
              setPage(1);
            }}
            style={{ width: 380 }}
          />
        </Group>

        {isLoading ? (
          <Box p="xl" style={{ display: 'flex', justifyContent: 'center' }}>
            <Loader color="cpsTeal" />
          </Box>
        ) : items.length > 0 ? (
          <>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr style={{ backgroundColor: '#f1f5f9' }}>
                  <Table.Th style={{ width: 170 }}>Fecha / Hora (BO)</Table.Th>
                  <Table.Th style={{ width: 130 }}>Usuario</Table.Th>
                  <Table.Th style={{ width: 220 }}>Acción Registrada</Table.Th>
                  <Table.Th style={{ width: 140 }}>Entidad</Table.Th>
                  <Table.Th>Detalles Sanitizados</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((it) => (
                  <Table.Tr key={it.id}>
                    <Table.Td style={{ fontSize: '0.8rem' }}>
                      {new Date(it.fecha).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}
                    </Table.Td>
                    <Table.Td style={{ fontWeight: 600 }}>{it.actorUsername || 'SISTEMA'}</Table.Td>
                    <Table.Td>
                      <Badge color="blue" variant="light" size="sm">
                        {it.accion}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ fontSize: '0.85rem' }}>{it.entidad}</Table.Td>
                    <Table.Td>
                      {it.detalleJson ? (
                        <Code block style={{ fontSize: '0.75rem', maxHeight: 80, overflowY: 'auto' }}>
                          {it.detalleJson}
                        </Code>
                      ) : (
                        <Text size="xs" c="dimmed">
                          Sin detalles adicionales
                        </Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Group justify="center" mt="md">
              <Pagination total={Math.ceil(total / 15) || 1} value={page} onChange={setPage} color="cpsTeal" />
            </Group>
          </>
        ) : (
          <Box p="xl" ta="center">
            <Text c="dimmed">No se encontraron registros de auditoría.</Text>
          </Box>
        )}
      </Paper>
    </Stack>
  );
};
