import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextInput,
  PasswordInput,
  Paper,
  Title,
  Text,
  Container,
  Button,
  Box,
  Alert,
  Stack,
  ThemeIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconLock, IconShieldCheck, IconAlertCircle } from '@tabler/icons-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Debe ingresar su usuario y contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      await login(username, password);
      notifications.show({
        title: 'Acceso Autorizado',
        message: 'Bienvenido al Sistema de Caja Chica de la Caja Petrolera de Salud.',
        color: 'teal',
      });
      navigate('/dashboard');
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        'Error de autenticación. Verifique sus credenciales o consulte al administrador.';
      setErrorMsg(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0fdfa 0%, #e2e8f0 100%)',
        padding: '1rem',
      }}
    >
      <Container size={420} my={40}>
        <Paper withBorder shadow="md" p={30} radius="md" style={{ backgroundColor: '#ffffff' }}>
          <Stack align="center" gap="xs" mb="lg">
            <ThemeIcon size={56} radius="xl" color="cpsTeal">
              <IconLock size={30} />
            </ThemeIcon>
            <Title order={2} ta="center" c="#007B6D" fw={800} style={{ letterSpacing: '0.5px' }}>
              CAJA PETROLERA DE SALUD
            </Title>
            <Text c="dimmed" size="xs" ta="center" fw={500}>
              SISTEMA INSTITUCIONAL DE CAJA CHICA MULTIUNIDAD
            </Text>
          </Stack>

          {errorMsg && (
            <Alert
              icon={<IconAlertCircle size={16} />}
              title="Acceso Denegado"
              color="red"
              mb="md"
              radius="sm"
            >
              {errorMsg}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Usuario Institucional"
                placeholder="ej. administrador o encargado"
                required
                value={username}
                onChange={(e) => setUsername(e.currentTarget.value)}
                autoComplete="username"
                disabled={isLoading}
              />

              <PasswordInput
                label="Contraseña"
                placeholder="Su contraseña de acceso"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                autoComplete="current-password"
                disabled={isLoading}
              />

              <Button
                type="submit"
                fullWidth
                loading={isLoading}
                color="cpsTeal"
                size="md"
                mt="xs"
              >
                Ingresar al Sistema
              </Button>
            </Stack>
          </form>

          <Box mt="xl" pt="md" style={{ borderTop: '1px solid #f1f5f9' }}>
            <Text size="xs" c="dimmed" ta="center">
              <IconShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Sesión segura mediante credenciales protegidas HttpOnly. Conforme a normativa institucional CPS.
            </Text>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};
