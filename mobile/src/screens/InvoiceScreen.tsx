import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerRootParamList, OwnerRootParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { vehicleSizeLabels, type VehicleSize } from '../types/booking';
import { formatMoney } from '../types/business';
import { formatWhen } from '../utils/schedule';

type Invoice = {
  id: string;
  number: string;
  issuedAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  registration: string;
  vehicleSize: VehicleSize;
  packageName: string;
  line: string;
  subtotal: string;
  tax: string;
  total: string;
  status: 'UNPAID' | 'PAID';
  startsAt: string;
};

type Props = {
  route: { params: { bookingId: string } };
  navigation: NativeStackScreenProps<CustomerRootParamList | OwnerRootParamList>['navigation'];
};

export function InvoiceScreen({ route }: Props) {
  const { request, user } = useAuth();
  const { bookingId } = route.params;
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    request<{ invoice: Invoice }>(`/api/bookings/${bookingId}/invoice`)
      .then((body) => {
        if (!cancelled) {
          setInvoice(body.invoice);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load this invoice.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId, request]);

  async function markPaid() {
    setPaying(true);
    setError(null);
    try {
      const body = await request<{ invoice: Invoice }>(`/api/bookings/${bookingId}/invoice/pay`, {
        method: 'POST',
      });
      setInvoice(body.invoice);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to mark this invoice paid.');
    } finally {
      setPaying(false);
    }
  }

  if (!invoice) {
    return (
      <ScrollScreen>
        {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.muted}>Loading…</Text>}
      </ScrollScreen>
    );
  }

  const paid = invoice.status === 'PAID';

  return (
    <ScrollScreen>
      <View style={styles.card}>
        <Text style={styles.shop}>Urban Glow Car Wash</Text>
        <View style={styles.headerRow}>
          <Text style={styles.number}>{invoice.number}</Text>
          <View style={[styles.pill, paid ? styles.pillPaid : null]}>
            <Text style={[styles.pillLabel, paid ? styles.pillLabelPaid : null]}>{paid ? 'PAID' : 'UNPAID'}</Text>
          </View>
        </View>
        <Text style={styles.muted}>{formatWhen(invoice.issuedAt)}</Text>
        <Text style={styles.section}>{invoice.packageName}</Text>
        <Text style={styles.line}>{invoice.customerName}</Text>
        <Text style={styles.line}>{invoice.customerPhone}</Text>
        <Text style={styles.line}>
          {vehicleSizeLabels[invoice.vehicleSize]} · {invoice.registration}
        </Text>
        <Text style={styles.line}>{formatWhen(invoice.startsAt)}</Text>
        <View style={styles.divider} />
        <MoneyRow label="Subtotal" value={formatMoney(invoice.subtotal)} />
        <MoneyRow label="Tax" value={formatMoney(invoice.tax)} />
        <MoneyRow label="Total" strong value={formatMoney(invoice.total)} />
        <Text style={styles.note}>Pay at the shop. There is no card payment.</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {user?.role === 'BUSINESS_OWNER' && invoice.status === 'UNPAID' ? (
        <PrimaryButton
          disabled={paying}
          label={paying ? 'Saving…' : 'Mark paid'}
          onPress={() => void markPaid()}
        />
      ) : null}
    </ScrollScreen>
  );
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.moneyRow}>
      <Text style={[styles.line, strong ? styles.totalLabel : null]}>{label}</Text>
      <Text style={[styles.line, strong ? styles.total : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
  },
  shop: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  number: {
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  pill: {
    backgroundColor: '#FFF6D8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillPaid: {
    backgroundColor: '#E7F6EC',
  },
  pillLabel: {
    color: colors.goldInk,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pillLabelPaid: {
    color: colors.ready,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  line: {
    color: colors.inkSoft,
    fontSize: 15,
    marginBottom: 4,
  },
  section: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 16,
  },
  divider: {
    backgroundColor: colors.line,
    height: 1,
    marginVertical: 12,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  total: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
    marginTop: 12,
  },
});
