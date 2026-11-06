import React, { useState, useEffect, useMemo } from 'react';
import {
  TextInput,
  Popover,
  ActionIcon,
  Group,
  Stack,
  Text,
  Button,
  UnstyledButton,
  Box,
} from '@mantine/core';
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import {
  formatDateToBO,
  parseBOToISODate,
  getFechaHoyBolivia,
} from '../../utils/dateUtils';

interface DateInputBOProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  value: string; // En formato API: YYYY-MM-DD
  onChange: (val: string) => void;
  error?: React.ReactNode;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  clearable?: boolean;
  size?: 'xs' | 'sm' | 'md';
  w?: any;
  style?: React.CSSProperties;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

export const DateInputBO: React.FC<DateInputBOProps> = ({
  label,
  description,
  placeholder = 'DD/MM/YYYY',
  required,
  disabled,
  readOnly,
  value,
  onChange,
  error,
  minDate,
  maxDate,
  clearable,
  size = 'sm',
  w,
  style,
}) => {
  const [popoverOpened, setPopoverOpened] = useState(false);
  const [textValue, setTextValue] = useState<string>('');
  const [internalError, setInternalError] = useState<string | null>(null);

  // Fecha para navegar en el calendario del Popover
  const hoyBolivia = getFechaHoyBolivia();
  const [navYear, setNavYear] = useState<number>(() => {
    if (value && value.length >= 4) return parseInt(value.slice(0, 4), 10);
    return parseInt(hoyBolivia.slice(0, 4), 10);
  });
  const [navMonth, setNavMonth] = useState<number>(() => {
    if (value && value.length >= 7) return parseInt(value.slice(5, 7), 10) - 1;
    return parseInt(hoyBolivia.slice(5, 7), 10) - 1;
  });

  // Sincronizar texto cuando cambia `value` externo
  useEffect(() => {
    if (value) {
      const bo = formatDateToBO(value);
      setTextValue(bo);
      setInternalError(null);
      const [y, m] = value.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setNavYear(y);
        setNavMonth(m - 1);
      }
    } else {
      setTextValue('');
      setInternalError(null);
    }
  }, [value]);

  // Manejar tipeo manual con auto-máscara DD/MM/AAAA
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d/]/g, '');

    // Auto-formato de barras
    if (raw.length === 2 && !raw.includes('/') && !textValue.endsWith('/')) {
      raw = raw + '/';
    } else if (raw.length === 5 && raw.split('/').length === 2 && !textValue.endsWith('/')) {
      raw = raw + '/';
    }

    if (raw.length > 10) {
      raw = raw.slice(0, 10);
    }

    setTextValue(raw);

    if (raw.length === 0) {
      setInternalError(null);
      onChange('');
      return;
    }

    if (raw.length === 10) {
      const parsedIso = parseBOToISODate(raw);
      if (!parsedIso) {
        setInternalError('Fecha no válida. Use el formato DD/MM/YYYY.');
      } else if (minDate && parsedIso < minDate) {
        setInternalError(`La fecha no puede ser anterior a ${formatDateToBO(minDate)}.`);
      } else if (maxDate && parsedIso > maxDate) {
        setInternalError(`La fecha no puede ser posterior a ${formatDateToBO(maxDate)}.`);
      } else {
        setInternalError(null);
        onChange(parsedIso);
      }
    } else {
      // Entrada incompleta, aún en tipeo
      setInternalError(null);
    }
  };

  const handleBlur = () => {
    if (textValue && textValue.length > 0 && textValue.length < 10) {
      setInternalError('Fecha incompleta. Ingrese DD/MM/YYYY (ej. 12/03/2026).');
    }
  };

  // Navegación de mes en calendario
  const handlePrevMonth = () => {
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear((y) => y - 1);
    } else {
      setNavMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear((y) => y + 1);
    } else {
      setNavMonth((m) => m + 1);
    }
  };

  // Días del mes para la cuadrícula
  const daysGrid = useMemo(() => {
    const firstDayOfWeek = (new Date(navYear, navMonth, 1).getDay() + 6) % 7; // 0 = Lunes, 6 = Domingo
    const totalDays = new Date(navYear, navMonth + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push(d);
    }
    return days;
  }, [navYear, navMonth]);

  const handleSelectDay = (day: number) => {
    const mm = String(navMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const isoDate = `${navYear}-${mm}-${dd}`;

    if (minDate && isoDate < minDate) {
      setInternalError(`La fecha no puede ser anterior a ${formatDateToBO(minDate)}.`);
      return;
    }
    if (maxDate && isoDate > maxDate) {
      setInternalError(`La fecha no puede ser posterior a ${formatDateToBO(maxDate)}.`);
      return;
    }

    setInternalError(null);
    onChange(isoDate);
    setPopoverOpened(false);
  };

  const handleSelectHoy = () => {
    onChange(hoyBolivia);
    setInternalError(null);
    setPopoverOpened(false);
  };

  const handleClear = () => {
    onChange('');
    setTextValue('');
    setInternalError(null);
    setPopoverOpened(false);
  };

  const displayedError = error || internalError;

  return (
    <Popover
      opened={popoverOpened && !readOnly && !disabled}
      onChange={setPopoverOpened}
      position="bottom-start"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <TextInput
          label={label}
          description={description}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          size={size}
          w={w}
          style={style}
          value={textValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          error={displayedError}
          rightSection={
            <Group gap={2} mr={4}>
              {clearable && value && !readOnly && !disabled && (
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  title="Borrar fecha"
                >
                  <IconX size={12} />
                </ActionIcon>
              )}
              <ActionIcon
                size={size === 'xs' ? 'xs' : 'sm'}
                variant="subtle"
                color="cpsTeal"
                onClick={() => setPopoverOpened((o) => !o)}
                disabled={readOnly || disabled}
                title="Abrir calendario (DD/MM/AAAA)"
              >
                <IconCalendar size={size === 'xs' ? 14 : 16} />
              </ActionIcon>
            </Group>
          }
        />
      </Popover.Target>

      <Popover.Dropdown p="xs" style={{ width: 280, backgroundColor: '#ffffff', borderRadius: 8 }}>
        <Stack gap="xs">
          {/* Cabecera con mes, año y controles */}
          <Group justify="space-between" align="center">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handlePrevMonth} title="Mes anterior">
              <IconChevronLeft size={16} />
            </ActionIcon>
            <Text fw={700} size="sm" c="#007B6D">
              {MESES[navMonth]} {navYear}
            </Text>
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={handleNextMonth} title="Mes siguiente">
              <IconChevronRight size={16} />
            </ActionIcon>
          </Group>

          {/* Días de la semana en español */}
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: 11,
              color: '#64748b',
              paddingBottom: 4,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            {DIAS_SEMANA.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </Box>

          {/* Cuadrícula de días */}
          <Box
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 2,
              textAlign: 'center',
            }}
          >
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <span key={idx} />;
              }

              const mm = String(navMonth + 1).padStart(2, '0');
              const dd = String(day).padStart(2, '0');
              const dayIso = `${navYear}-${mm}-${dd}`;
              const isSelected = value === dayIso;
              const isToday = hoyBolivia === dayIso;
              const isOutMin = minDate ? dayIso < minDate : false;
              const isOutMax = maxDate ? dayIso > maxDate : false;
              const isDayDisabled = isOutMin || isOutMax;

              return (
                <UnstyledButton
                  key={idx}
                  onClick={() => !isDayDisabled && handleSelectDay(day)}
                  disabled={isDayDisabled}
                  style={{
                    padding: '6px 0',
                    fontSize: 12,
                    borderRadius: 4,
                    fontWeight: isSelected ? 700 : isToday ? 600 : 400,
                    backgroundColor: isSelected ? '#007B6D' : 'transparent',
                    color: isSelected ? '#ffffff' : isDayDisabled ? '#cbd5e1' : isToday ? '#007B6D' : '#1e293b',
                    border: isToday && !isSelected ? '1px solid #007B6D' : 'none',
                    cursor: isDayDisabled ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {day}
                </UnstyledButton>
              );
            })}
          </Box>

          {/* Barra de acciones rápidas */}
          <Group justify="space-between" mt={4} pt={4} style={{ borderTop: '1px solid #f1f5f9' }}>
            {clearable ? (
              <Button size="compact-xs" variant="subtle" color="gray" onClick={handleClear}>
                Limpiar
              </Button>
            ) : (
              <span />
            )}
            <Button size="compact-xs" variant="light" color="cpsTeal" onClick={handleSelectHoy}>
              Hoy ({formatDateToBO(hoyBolivia)})
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
};
