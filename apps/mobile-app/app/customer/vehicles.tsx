import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/components/ui';
import { getCurrentSession } from '@/lib/auth';
import { getOperationalCustomerContexts, isPortfolioCustomerContext, type CustomerAccountContext } from '@/lib/customer-context';
import { supabase } from '@/lib/supabase';
import { palette } from '@/lib/theme';
import type { Claim, InsuranceCompany, Policy, Vehicle } from '@/lib/types';

type PickedEndorsementFile = { name: string; mimeType?: string | null; size?: number | null; uri: string };

const truckSketch = require('../../assets/vehicles/truck sketch.png');
const carSketch = require('../../assets/vehicles/car sketch.png');

const insurerLogos = {
  hdfc: require('../../assets/vehicles/hdfc-ergo.png'),
  bajaj: require('../../assets/vehicles/bajaj-allianz.png'),
  tata: require('../../assets/vehicles/tata-aig.png'),
};

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [insurers, setInsurers] = useState<InsuranceCompany[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [contexts, setContexts] = useState<CustomerAccountContext[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilterId, setCompanyFilterId] = useState('all');
  const [companyFilterOpen, setCompanyFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [renewalVehicleId, setRenewalVehicleId] = useState<string | null>(null);
  const [ownerChange, setOwnerChange] = useState<'yes' | 'no' | ''>('');
  const [claimInLastYear, setClaimInLastYear] = useState<'yes' | 'no' | ''>('');
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [addVehicleSuccess, setAddVehicleSuccess] = useState(false);
  const [addVehicleDocs, setAddVehicleDocs] = useState(false);
  const [addVehicleThankYou, setAddVehicleThankYou] = useState(false);
  const [addMethod, setAddMethod] = useState<'vehicle' | 'policy' | 'chassis'>('vehicle');
  const [addValue, setAddValue] = useState('');
  const [endorsementOpen, setEndorsementOpen] = useState(false);
  const [endorsementOption, setEndorsementOption] = useState('');
  const [endorsementFile, setEndorsementFile] = useState<PickedEndorsementFile | null>(null);
  const [endorsementDetails, setEndorsementDetails] = useState('');
  const [endorsementSuccess, setEndorsementSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const session = await getCurrentSession();
      if (!session?.user) return router.replace('/login');

      const contexts = await getOperationalCustomerContexts();
      const ids = contexts.map((context) => context.customer_id);
      setContexts(contexts);
      if (ids.length) {
        const [vehicleResult, policyResult, claimResult, insurerResult] = await Promise.all([
          supabase.from('vehicles').select('*').in('customer_id', ids).order('created_at', { ascending: false }),
          supabase.from('policies').select('*').in('customer_id', ids),
          supabase.from('claims').select('*').in('customer_id', ids),
          supabase.from('insurance_companies').select('*'),
        ]);

        setVehicles(vehicleResult.data ?? []);
        setPolicies(policyResult.data ?? []);
        setClaims(claimResult.data ?? []);
        setInsurers(insurerResult.data ?? []);
      }

      setLoading(false);
    }

    void load();
  }, [router]);

  const expiringSoon = policies.filter((policy) => {
    const days = daysUntil(policy.end_date);
    return days >= 0 && days <= 30;
  }).length;

  const renewalMessage = useMemo(() => {
    if (expiringSoon > 0) return `${expiringSoon} policy${expiringSoon === 1 ? '' : 'ies'} need attention soon`;
    return 'Renew your policy on time and keep your vehicles protected';
  }, [expiringSoon]);
  const isPortfolioFleet = contexts.some(isPortfolioCustomerContext);
  const companyOptions = useMemo(() => {
    const options = contexts
      .filter((context) => vehicleCompanyName(context.customer_id, contexts))
      .map((context) => ({ id: context.customer_id, name: vehicleCompanyName(context.customer_id, contexts) }));
    return Array.from(new Map(options.map((item) => [item.id, item])).values());
  }, [contexts]);
  const selectedCompanyLabel = companyFilterId === 'all'
    ? 'All companies'
    : companyOptions.find((item) => item.id === companyFilterId)?.name ?? 'All companies';
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) => {
    if (companyFilterId !== 'all' && vehicle.customer_id !== companyFilterId) return false;
    const policy = latestPolicyFor(vehicle.id, policies);
    const insurer = policy ? insurers.find((item) => item.id === policy.insurance_company_id) : null;
    const company = vehicleCompanyName(vehicle.customer_id, contexts);
    const haystack = [
      vehicle.vehicle_no,
      vehicle.make,
      vehicle.model,
      vehicle.year ? String(vehicle.year) : '',
      policy?.policy_no,
      insurer?.name,
      company,
    ].filter(Boolean).join(' ').toLowerCase();
    return !searchQuery.trim() || haystack.includes(searchQuery.trim().toLowerCase());
  }), [companyFilterId, contexts, insurers, policies, searchQuery, vehicles]);

  function openRenewal(vehicleId: string) {
    setRenewalVehicleId(vehicleId);
    setOwnerChange('');
    setClaimInLastYear('');
    setRenewalSuccess(false);
  }

  function submitRenewal() {
    setRenewalVehicleId(null);
    setRenewalSuccess(true);
  }

  function openAddVehicle() {
    if (isPortfolioFleet) {
      router.push('/customer/add-vehicle');
      return;
    }
    setAddMethod('vehicle');
    setAddValue('');
    setAddVehicleOpen(true);
  }

  function submitAddVehicle() {
    setAddVehicleOpen(false);
    setAddVehicleDocs(true);
  }

  function submitAddVehicleDocs() {
    setAddVehicleDocs(false);
    setAddVehicleThankYou(true);
  }

  function openEndorsement() {
    setEndorsementOption('');
    setEndorsementFile(null);
    setEndorsementDetails('');
    setEndorsementOpen(true);
  }

  function submitEndorsement() {
    if (!endorsementOption || !endorsementFile || !endorsementDetails.trim()) return;
    setEndorsementOpen(false);
    setEndorsementSuccess(true);
  }

  function selectEndorsementOption(option: string) {
    setEndorsementOption(option);
    setEndorsementFile(null);
    setEndorsementDetails('');
  }

  async function pickEndorsementDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEndorsementFile({ name: asset.name, mimeType: asset.mimeType, size: asset.size, uri: asset.uri });
    }
  }

  if (loading) return <Screen title="My Vehicles"><LoadingState /></Screen>;

  return (
    <Screen title="My Vehicles" showLogout showTitleHeader={false}>
      <View style={styles.pageHeader}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>My Vehicles</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{vehicles.length} Vehicle{vehicles.length === 1 ? '' : 's'}</Text>
            </View>
          </View>
          <Text style={styles.pageSub}>Manage your vehicle insurance policies</Text>
        </View>

        <Pressable accessibilityRole="button" onPress={openAddVehicle} style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Vehicle</Text>
        </Pressable>
      </View>

      {vehicles.length ? (
        <View style={styles.filterPanel}>
          <View style={styles.filterRow}>
            <View style={styles.globalSearch}>
              <MaterialCommunityIcons name="magnify" size={17} color="#0A43A3" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search"
                placeholderTextColor="#7F8EA4"
                style={styles.globalSearchInput}
              />
              {searchQuery ? (
                <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} style={styles.clearSearch}>
                  <MaterialCommunityIcons name="close" size={14} color="#7A8799" />
                </Pressable>
              ) : null}
            </View>
            <Pressable accessibilityRole="button" onPress={() => setCompanyFilterOpen((value) => !value)} style={styles.companyDropdown}>
              <Text style={styles.companyDropdownText} numberOfLines={1}>{selectedCompanyLabel}</Text>
              <MaterialCommunityIcons name={companyFilterOpen ? 'chevron-up' : 'chevron-down'} size={18} color={palette.navy} />
            </Pressable>
          </View>
          {companyFilterOpen ? (
            <View style={styles.companyMenu}>
              <Pressable onPress={() => { setCompanyFilterId('all'); setCompanyFilterOpen(false); }} style={[styles.companyOption, companyFilterId === 'all' && styles.companyOptionActive]}>
                <Text style={[styles.companyOptionText, companyFilterId === 'all' && styles.companyOptionTextActive]}>All companies</Text>
              </Pressable>
              {companyOptions.map((company) => (
                <Pressable key={company.id} onPress={() => { setCompanyFilterId(company.id); setCompanyFilterOpen(false); }} style={[styles.companyOption, companyFilterId === company.id && styles.companyOptionActive]}>
                  <Text style={[styles.companyOptionText, companyFilterId === company.id && styles.companyOptionTextActive]} numberOfLines={1}>{company.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {vehicles.length === 0 ? <EmptyState title="No vehicles yet" body="Vehicle records will appear here." /> : null}
      {vehicles.length > 0 && filteredVehicles.length === 0 ? <EmptyState title="No matching vehicles" body="Try a different search or company filter." /> : null}

      {filteredVehicles.map((vehicle) => {
        const policy = latestPolicyFor(vehicle.id, policies);
        const insurer = policy ? insurers.find((item) => item.id === policy.insurance_company_id) : null;
        const active = Boolean(policy && isPolicyActive(policy));
        const insurerLogo = insurerImage(insurer?.name);
        const vehicleDescriptor = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null].filter(Boolean).join(' - ') || 'Vehicle details pending';
        const accountName = vehicleCompanyName(vehicle.customer_id, contexts);
        const vehicleImage = isPrivateVehicle(vehicle) ? carSketch : truckSketch;
        const health = vehicleComplianceHealth(vehicle, policy);

        return (
          <Pressable key={vehicle.id} onPress={() => router.push({ pathname: '/customer/vehicle-detail', params: { id: vehicle.id } })} style={({ pressed }) => [styles.vehicleCard, pressed && styles.vehicleCardPressed]}>
            <View style={styles.cardMain}>
              <View style={styles.leftPane}>
                {accountName ? <Text style={styles.accountName} numberOfLines={1}>{accountName}</Text> : null}
                <View style={styles.chipRow}>
                  <View style={styles.vehicleNoChip}>
                    <Text style={styles.vehicleNoText}>{vehicle.vehicle_no}</Text>
                    <MaterialCommunityIcons name="content-copy" size={13} color={palette.navy} />
                  </View>
                </View>

                <Image source={vehicleImage} style={styles.truckImage} resizeMode="contain" />

                <Text style={styles.vehicleMake} numberOfLines={1}>{vehicleDescriptor}</Text>
              </View>

              <View style={styles.rightPane}>
                <InfoBlock
                  icon="shield-car"
                  iconBg="#EAF3FF"
                  iconColor={palette.navy}
                  label="Insurance Company"
                  value={insurer?.name ?? 'Insurance company pending'}
                  logo={insurerLogo}
                />
                <InfoBlock
                  icon="file-document-outline"
                  iconBg="#EAF8F1"
                  iconColor="#12805C"
                  label="Policy Number"
                  value={policy?.policy_no ?? '-'}
                  statusActive={active}
                />
                <InfoBlock
                  icon="calendar-alert"
                  iconBg="#FFECEF"
                  iconColor="#E84C88"
                  label="Policy Expiry Date"
                  value={policy ? formatDate(policy.end_date) : '-'}
                />
                {!policy ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push({ pathname: '/customer/add-policy', params: { vehicleId: vehicle.id } });
                    }}
                    style={styles.inlineAddPolicy}
                  >
                    <MaterialCommunityIcons name="shield-plus-outline" size={14} color="#0A43A3" />
                    <Text style={styles.inlineAddPolicyText}>Add policy</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <ComplianceHealthRow health={health} />
          </Pressable>
        );
      })}

      <RenewalModal
        visible={Boolean(renewalVehicleId)}
        ownerChange={ownerChange}
        claimInLastYear={claimInLastYear}
        setOwnerChange={setOwnerChange}
        setClaimInLastYear={setClaimInLastYear}
        onClose={() => setRenewalVehicleId(null)}
        onSubmit={submitRenewal}
      />

      <RenewalSuccessModal visible={renewalSuccess} onClose={() => setRenewalSuccess(false)} />

      <AddVehicleModal
        visible={addVehicleOpen}
        method={addMethod}
        value={addValue}
        setMethod={setAddMethod}
        setValue={setAddValue}
        onClose={() => setAddVehicleOpen(false)}
        onSubmit={submitAddVehicle}
      />

      <AddVehicleSuccessModal visible={addVehicleSuccess} onClose={() => setAddVehicleSuccess(false)} type="request" />

      <AddVehicleDocsModal visible={addVehicleDocs} onClose={() => setAddVehicleDocs(false)} onSubmit={submitAddVehicleDocs} />

      <AddVehicleSuccessModal visible={addVehicleThankYou} onClose={() => setAddVehicleThankYou(false)} type="thankyou" />

      <EndorsementModal
        visible={endorsementOpen}
        selected={endorsementOption}
        file={endorsementFile}
        details={endorsementDetails}
        onSelect={selectEndorsementOption}
        onPickDocument={() => void pickEndorsementDocument()}
        onDetailsChange={setEndorsementDetails}
        onClose={() => setEndorsementOpen(false)}
        onSubmit={submitEndorsement}
      />

      <EndorsementSuccessModal visible={endorsementSuccess} onClose={() => setEndorsementSuccess(false)} />

      <View style={styles.protectionBanner}>
        <View style={styles.bannerIcon}>
          <MaterialCommunityIcons name="shield-check-outline" size={25} color={palette.navy} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={styles.bannerTitle}>Stay Protected, Always!</Text>
          <Text style={styles.bannerText}>{renewalMessage}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push(isPortfolioFleet ? '/customer/group/policies' : '/customer/policies')} style={styles.viewRenewals}>
          <Text style={styles.viewRenewalsText}>View Renewals</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={palette.navy} />
        </Pressable>
      </View>
    </Screen>
  );
}

function AddVehicleModal({
  visible,
  method,
  value,
  setMethod,
  setValue,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  method: 'vehicle' | 'policy' | 'chassis';
  value: string;
  setMethod: (value: 'vehicle' | 'policy' | 'chassis') => void;
  setValue: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.addVehicleModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <Text style={styles.addVehicleTitle}>Add Vehicle</Text>
          <Text style={styles.addVehicleSub}>Enter <Text style={styles.boldBlue}>any one</Text> of the following details to add your vehicle</Text>

          <AddVehicleOption
            selected={method === 'vehicle'}
            icon="car"
            label="Vehicle Number"
            placeholder="e.g. MH01AB1234"
            value={method === 'vehicle' ? value : ''}
            onSelect={() => { setMethod('vehicle'); setValue(''); }}
            onChangeText={setValue}
          />

          <OrDivider />

          <AddVehicleOption
            selected={method === 'policy'}
            icon="clipboard-list-outline"
            label="Policy Number"
            placeholder="e.g. IL/2025/1234567"
            value={method === 'policy' ? value : ''}
            onSelect={() => { setMethod('policy'); setValue(''); }}
            onChangeText={setValue}
          />

          <OrDivider />

          <AddVehicleOption
            selected={method === 'chassis'}
            icon="axis-arrow"
            label="Chassis Number"
            placeholder="e.g. MA3EJWB1S00123456"
            value={method === 'chassis' ? value : ''}
            onSelect={() => { setMethod('chassis'); setValue(''); }}
            onChangeText={setValue}
          />

          <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.addSubmitButton}>
            <Text style={styles.addSubmitText}>Submit</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AddVehicleOption({
  selected,
  icon,
  label,
  placeholder,
  value,
  onSelect,
  onChangeText,
}: {
  selected: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  placeholder: string;
  value: string;
  onSelect: () => void;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.addOptionRow}>
      <Pressable accessibilityRole="button" onPress={onSelect} style={styles.addRadioWrap}>
        <View style={[styles.addRadio, selected && styles.addRadioSelected]} />
      </Pressable>

      <View style={styles.addOptionIcon}>
        <MaterialCommunityIcons name={icon} size={28} color="#1254D1" />
      </View>

      <View style={styles.addOptionCopy}>
        <Text style={styles.addOptionLabel}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          editable={selected}
          placeholder={placeholder}
          placeholderTextColor="#A8B3C5"
          style={[styles.addInput, !selected && styles.addInputDisabled]}
        />
      </View>
    </View>
  );
}

function OrDivider() {
  return (
    <View style={styles.orRow}>
      <View style={styles.orLine} />
      <View style={styles.orBubble}>
        <Text style={styles.orText}>OR</Text>
      </View>
      <View style={styles.orLine} />
    </View>
  );
}

function AddVehicleSuccessModal({ visible, onClose, type }: { visible: boolean; onClose: () => void; type: 'request' | 'thankyou' | 'congrats' }) {
  const title = type === 'request' ? 'Request Submitted' : type === 'thankyou' ? 'Thank You!' : 'Congratulations!';
  const body = type === 'request'
    ? 'We will check our records and verify the details provided. If a matching vehicle or policy is found, it will be added to your account shortly.'
    : type === 'thankyou'
      ? 'Thank you for uploading the required documents. Our team will verify the details and your vehicle will be added to your account soon.'
      : 'Your vehicle is added successfully. Kindly check in My Vehicles option.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.addSuccessModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={53} color="#FFFFFF" />
          </View>

          <Text style={styles.addSuccessTitle}>{title}</Text>
          <Text style={styles.addSuccessText}>{body}</Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function AddVehicleDocsModal({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.docsModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.docsClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#E3342F" />
          <Text style={styles.docsTitle}>Sorry!</Text>
          <Text style={styles.docsText}>This vehicle is not in our records. Kindly share the following documents to add your vehicle.</Text>

          <View style={styles.docsList}>
            <Text style={styles.docsListText}>1. RC Copy</Text>
            <Text style={styles.docsListText}>2. Insurance Copy</Text>
          </View>

          <UploadBox label="1. RC Copy" />
          <UploadBox label="2. Insurance Copy" />

          <View style={styles.docsActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.docsCancel}>
              <Text style={styles.docsCancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onSubmit} style={styles.docsSubmit}>
              <Text style={styles.docsSubmitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function UploadBox({ label }: { label: string }) {
  return (
    <View style={styles.uploadGroup}>
      <Text style={styles.uploadLabel}>{label}</Text>
      <View style={styles.uploadBox}>
        <MaterialCommunityIcons name="cloud-upload-outline" size={28} color="#1254D1" />
        <Text style={styles.uploadText}>Click to upload or drag and drop</Text>
        <Text style={styles.uploadSub}>JPG, PNG, PDF (Max. 5MB)</Text>
      </View>
    </View>
  );
}

function EndorsementModal({
  visible,
  selected,
  file,
  details,
  onSelect,
  onPickDocument,
  onDetailsChange,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  selected: string;
  file: PickedEndorsementFile | null;
  details: string;
  onSelect: (value: string) => void;
  onPickDocument: () => void;
  onDetailsChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const options = ['Owner change', 'Make model change', 'Bodytype', 'Wrong GVW', 'Wrong registration number', 'Gst not mention', 'Other'];
  const requirement = endorsementDocumentRequirement(selected);
  const canSubmit = Boolean(selected && file && details.trim());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.endorsementModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={25} color={palette.navy} />
          </Pressable>

          <View style={styles.modalIconBubble}>
            <MaterialCommunityIcons name="file-document-check-outline" size={39} color="#1254D1" />
          </View>

          <Text style={styles.endorsementTitle}>We are happy to help you!</Text>
          <Text style={styles.endorsementSub}>Kindly mention what type of endorsement is this</Text>

          <View style={styles.endorsementOptions}>
            {options.map((option) => (
              <Pressable key={option} accessibilityRole="button" onPress={() => onSelect(option)} style={styles.endorsementOption}>
                <View style={[styles.radioCircle, selected === option && styles.radioCircleSelected]} />
                <Text style={styles.endorsementOptionText}>{option}</Text>
              </Pressable>
            ))}
          </View>

          {selected ? (
            <View style={styles.endorsementRequirement}>
              <Text style={styles.endorsementRequirementLabel}>Required document</Text>
              <Pressable accessibilityRole="button" onPress={onPickDocument} style={[styles.endorsementUploadBox, file && styles.endorsementUploadBoxDone]}>
                <View style={styles.endorsementUploadIcon}>
                  <MaterialCommunityIcons name={file ? 'file-check-outline' : 'cloud-upload-outline'} size={22} color={file ? '#12805C' : '#1254D1'} />
                </View>
                <View style={styles.endorsementUploadCopy}>
                  <Text style={styles.endorsementUploadTitle}>{file ? file.name : `Upload ${requirement}`}</Text>
                  <Text style={styles.endorsementUploadSub}>{file ? 'Document attached successfully' : 'PDF, JPG, PNG or WEBP up to 5 MB'}</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {selected && file ? (
            <View style={styles.endorsementDetailsBox}>
              <Text style={styles.endorsementRequirementLabel}>Exact endorsement request</Text>
              <TextInput
                value={details}
                onChangeText={onDetailsChange}
                multiline
                placeholder="Briefly mention the exact correction/change required."
                placeholderTextColor="#91A3BA"
                style={styles.endorsementDetailsInput}
              />
            </View>
          ) : null}

          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={onSubmit} style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function endorsementDocumentRequirement(option: string) {
  if (!option) return 'supporting document';
  if (option === 'Gst not mention') return 'GST certificate';
  if (option === 'Other') return 'relevant document';
  return 'RC copy';
}

function EndorsementSuccessModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.successModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={26} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={54} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successText}>
            Thanks for sharing your endorsement request. Our agent will call you with the next steps shortly.
          </Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RenewalModal({
  visible,
  ownerChange,
  claimInLastYear,
  setOwnerChange,
  setClaimInLastYear,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  ownerChange: 'yes' | 'no' | '';
  claimInLastYear: 'yes' | 'no' | '';
  setOwnerChange: (value: 'yes' | 'no') => void;
  setClaimInLastYear: (value: 'yes' | 'no') => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const canSubmit = Boolean(ownerChange && claimInLastYear);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.renewalModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalClose}>
            <MaterialCommunityIcons name="close" size={24} color={palette.navy} />
          </Pressable>

          <View style={styles.modalIconBubble}>
            <MaterialCommunityIcons name="file-document-check-outline" size={39} color="#1254D1" />
          </View>

          <Text style={styles.renewalTitle}>We are happy to help in your renewal!</Text>
          <Text style={styles.renewalSubtitle}>Kindly provide below details</Text>

          <Question title="Owner change in last 365 days?" value={ownerChange} onChange={setOwnerChange} />
          <Question title="Any claim in last 365 days?" value={claimInLastYear} onChange={setClaimInLastYear} />

          <View style={styles.modalActions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={!canSubmit} onPress={onSubmit} style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}>
              <Text style={styles.submitText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Question({ title, value, onChange }: { title: string; value: 'yes' | 'no' | ''; onChange: (value: 'yes' | 'no') => void }) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.questionTitle}>{title}</Text>
      <View style={styles.radioRow}>
        <Pressable accessibilityRole="button" onPress={() => onChange('yes')} style={styles.radioOption}>
          <View style={[styles.radioCircle, value === 'yes' && styles.radioCircleSelected]} />
          <Text style={styles.radioText}>Yes</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => onChange('no')} style={styles.radioOption}>
          <View style={[styles.radioCircle, value === 'no' && styles.radioCircleSelected]} />
          <Text style={styles.radioText}>No</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RenewalSuccessModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.successModal}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.successClose}>
            <MaterialCommunityIcons name="close" size={26} color={palette.navy} />
          </Pressable>

          <View style={styles.successIcon}>
            <MaterialCommunityIcons name="check" size={54} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>Thank You!</Text>
          <Text style={styles.successText}>
            Thanks for showing your interest in renewing your policy. Soon, you will get your quotation with proper guidance from our experts.
          </Text>

          <Pressable accessibilityRole="button" onPress={onClose} style={styles.okButton}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoBlock({ icon, iconBg, iconColor, label, value, logo, statusActive }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; iconBg: string; iconColor: string; label: string; value: string; logo?: number | null; statusActive?: boolean }) {
  return (
    <View style={styles.infoBlock}>
      <View style={[styles.infoIcon, { backgroundColor: iconBg }]}>
        {logo ? <Image source={logo} style={styles.insurerLogo} resizeMode="contain" /> : <MaterialCommunityIcons name={icon} size={18} color={iconColor} />}
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <View style={styles.infoValueRow}>
          {typeof statusActive === 'boolean' ? <BlinkingPolicyDot active={statusActive} /> : null}
          <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
        </View>
      </View>
    </View>
  );
}

function BlinkingPolicyDot({ active }: { active: boolean }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.28, duration: 720, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 720, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.policyStatusDot, active ? styles.policyStatusDotActive : styles.policyStatusDotInactive, { opacity }]} />;
}

type ComplianceHealth = {
  tone: 'green' | 'yellow' | 'red' | 'grey';
  title: string;
  detail: string;
  due: number;
  expired: number;
};

function ComplianceHealthRow({ health }: { health: ComplianceHealth }) {
  const config = {
    green: { icon: 'shield-check-outline' as const, color: '#12805C' },
    yellow: { icon: 'calendar-alert-outline' as const, color: '#B7791F' },
    red: { icon: 'alert-circle-outline' as const, color: '#C43D2D' },
    grey: { icon: 'file-search-outline' as const, color: '#667085' },
  }[health.tone];

  return (
    <View style={styles.complianceHealth}>
      <MaterialCommunityIcons name={config.icon} size={15} color={config.color} />
      <Text style={styles.complianceHealthLabel}>Compliance</Text>
      <View style={styles.complianceHealthDivider} />
      <HealthDot tone={health.tone} />
      <Text style={[styles.complianceHealthTitle, { color: config.color }]} numberOfLines={1}>{health.title}</Text>
    </View>
  );
}

function HealthDot({ tone }: { tone: ComplianceHealth['tone'] }) {
  if (tone === 'red' || tone === 'yellow') return <PulsingHealthDot tone={tone} />;
  return <View style={[styles.healthDot, tone === 'green' ? styles.healthDotGreen : styles.healthDotGrey]} />;
}

function PulsingHealthDot({ tone }: { tone: 'red' | 'yellow' }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0.35, duration: 680, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.35, duration: 680, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 680, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 680, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return <Animated.View style={[styles.healthDot, tone === 'red' ? styles.healthDotRed : styles.healthDotYellow, { opacity, transform: [{ scale }] }]} />;
}

function vehicleComplianceHealth(vehicle: Vehicle, policy?: Policy): ComplianceHealth {
  const documents = [
    { key: 'policy', date: policy?.end_date ?? null },
    { key: 'puc', date: vehicle.puc_expiry_date },
    ...(isPrivateVehicle(vehicle) ? [] : [
      { key: 'fitness', date: vehicle.fitness_expiry_date },
      { key: 'road_tax', date: vehicle.road_tax_expiry_date },
      { key: 'national_permit', date: vehicle.national_permit_expiry_date },
      { key: 'local_permit', date: vehicle.local_permit_expiry_date },
    ]),
  ];
  const tracked = documents.filter((item) => item.date);

  if (!tracked.length) {
    return { tone: 'grey', title: 'Details pending', detail: 'Add policy and compliance expiry dates', due: 0, expired: 0 };
  }

  const expired = tracked.filter((item) => daysUntil(item.date as string) < 0).length;
  const due = tracked.filter((item) => {
    const days = daysUntil(item.date as string);
    return days >= 0 && days <= 45;
  }).length;

  if (expired) {
    return {
      tone: 'red',
      title: `${expired} expired${due ? `, ${due} due soon` : ''}`,
      detail: 'Open details to review document dates',
      due,
      expired,
    };
  }
  if (due) {
    return {
      tone: 'yellow',
      title: `${due} due within 45 days`,
      detail: 'Renew upcoming documents before expiry',
      due,
      expired,
    };
  }

  return {
    tone: 'green',
    title: 'All documents up to date',
    detail: `${tracked.length} tracked document${tracked.length === 1 ? '' : 's'} clear`,
    due,
    expired,
  };
}

function latestPolicyFor(vehicleId: string, policies: Policy[]) {
  return policies.filter((policy) => policy.vehicle_id === vehicleId).sort((a, b) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0];
}

function isPolicyActive(policy: Policy) {
  return new Date(policy.end_date).getTime() >= Date.now();
}

function isPrivateVehicle(vehicle: Vehicle) {
  return (vehicle.vehicle_type ?? '').toLowerCase().includes('private');
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function vehicleCompanyName(customerId: string, contexts: CustomerAccountContext[]) {
  const context = contexts.find((item) => item.customer_id === customerId);
  if (!context?.company_name?.trim()) return '';
  if (!['corporate', 'dealership', 'individual_proprietor'].includes(context.partner_type)) return '';
  return context.company_name.trim();
}

function insurerImage(name?: string | null) {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('hdfc')) return insurerLogos.hdfc;
  if (normalized.includes('bajaj') || normalized.includes('allianz') || normalized.includes('alliance')) return insurerLogos.bajaj;
  if (normalized.includes('tata') || normalized.includes('aig')) return insurerLogos.tata;
  return null;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const styles = StyleSheet.create({
  addVehicleModal: { width: '100%', maxWidth: 420, borderRadius: 16, backgroundColor: '#FFFFFF', paddingHorizontal: 26, paddingTop: 25, paddingBottom: 26, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  addVehicleTitle: { color: palette.navy, fontSize: 25, lineHeight: 31, fontWeight: '900', marginBottom: 22 },
  addVehicleSub: { color: palette.slate, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 24 },
  boldBlue: { color: '#1254D1', fontWeight: '900' },
  addOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addRadioWrap: { width: 26, height: 58, alignItems: 'center', justifyContent: 'center' },
  addRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.8, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  addRadioSelected: { borderWidth: 5.2, borderColor: '#1254D1' },
  addOptionIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  addOptionCopy: { flex: 1, minWidth: 0 },
  addOptionLabel: { color: palette.navy, fontSize: 16, lineHeight: 21, fontWeight: '900', marginBottom: 8 },
  addInput: { height: 44, borderWidth: 1, borderColor: '#DCE4EF', borderRadius: 7, paddingHorizontal: 13, color: palette.ink, fontSize: 14, fontWeight: '700', backgroundColor: '#FFFFFF' },
  addInputDisabled: { backgroundColor: '#FAFBFD', opacity: 0.7 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15, marginLeft: 82 },
  orLine: { flex: 1, height: 1, backgroundColor: '#E5EAF2' },
  orBubble: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  orText: { color: palette.navy, fontSize: 13, fontWeight: '900' },
  addSubmitButton: { height: 50, borderRadius: 7, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center', marginTop: 27 },
  addSubmitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  addSuccessModal: { width: '100%', maxWidth: 390, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 30, paddingTop: 42, paddingBottom: 30, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  addSuccessTitle: { color: palette.navy, fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center', marginTop: 20 },
  addSuccessText: { color: palette.navy, fontSize: 14.5, lineHeight: 23, fontWeight: '700', textAlign: 'center', marginTop: 13, marginBottom: 26 },

  docsModal: { width: '100%', maxWidth: 390, borderRadius: 14, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingTop: 25, paddingBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 16, elevation: 9 },
  docsClose: { position: 'absolute', right: 14, top: 12, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  docsTitle: { color: palette.navy, fontSize: 22, fontWeight: '900', marginTop: 7 },
  docsText: { color: palette.navy, fontSize: 13.2, lineHeight: 19, fontWeight: '700', textAlign: 'center', marginTop: 6 },
  docsList: { width: '100%', marginTop: 13, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5EAF2' },
  docsListText: { color: palette.navy, fontSize: 13, lineHeight: 20, fontWeight: '800' },
  uploadGroup: { width: '100%', marginTop: 12 },
  uploadLabel: { color: palette.navy, fontSize: 13, fontWeight: '900', marginBottom: 7 },
  uploadBox: { height: 76, borderRadius: 9, borderWidth: 1.2, borderStyle: 'dashed', borderColor: '#8BB8F3', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBFDFF' },
  uploadText: { color: '#1254D1', fontSize: 11.5, fontWeight: '800', marginTop: 3 },
  uploadSub: { color: palette.slate, fontSize: 10, fontWeight: '700', marginTop: 2 },
  docsActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 16 },
  docsCancel: { flex: 1, height: 42, borderRadius: 6, borderWidth: 1.2, borderColor: '#1254D1', alignItems: 'center', justifyContent: 'center' },
  docsCancelText: { color: '#1254D1', fontSize: 13, fontWeight: '900' },
  docsSubmit: { flex: 1, height: 42, borderRadius: 6, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  docsSubmitText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  endorsementModal: { width: '100%', maxWidth: 370, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 22, paddingTop: 24, paddingBottom: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  endorsementTitle: { color: palette.navy, fontSize: 17, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  endorsementSub: { color: palette.slate, fontSize: 12.5, lineHeight: 17, fontWeight: '700', marginTop: 5, marginBottom: 16, textAlign: 'center' },
  endorsementOptions: { width: '100%', gap: 10, marginBottom: 14 },
  endorsementOption: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endorsementOptionText: { color: palette.navy, fontSize: 13.2, fontWeight: '700' },
  endorsementRequirement: { width: '100%', marginBottom: 12 },
  endorsementRequirementLabel: { color: palette.slate, fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.35, marginBottom: 7 },
  endorsementUploadBox: { minHeight: 62, borderRadius: 14, borderWidth: 1.2, borderStyle: 'dashed', borderColor: '#9FC4F5', backgroundColor: '#F8FBFF', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  endorsementUploadBoxDone: { borderStyle: 'solid', borderColor: '#BFEBD0', backgroundColor: '#F7FFFB' },
  endorsementUploadIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center' },
  endorsementUploadCopy: { flex: 1, minWidth: 0 },
  endorsementUploadTitle: { color: palette.navy, fontSize: 12.5, fontWeight: '900' },
  endorsementUploadSub: { color: palette.slate, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  endorsementDetailsBox: { width: '100%', marginBottom: 13 },
  endorsementDetailsInput: { minHeight: 76, borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', paddingHorizontal: 11, paddingVertical: 9, color: palette.ink, fontSize: 12.5, fontWeight: '700', textAlignVertical: 'top' },

  renewalModal: { width: '100%', maxWidth: 365, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 26, paddingTop: 26, paddingBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  modalClose: { position: 'absolute', right: 16, top: 14, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  modalIconBubble: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  renewalTitle: { color: palette.navy, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  renewalSubtitle: { color: palette.slate, fontSize: 13.5, fontWeight: '700', marginTop: 5, marginBottom: 19, textAlign: 'center' },
  questionBlock: { width: '100%', alignItems: 'center', marginBottom: 19 },
  questionTitle: { color: palette.navy, fontSize: 13.6, fontWeight: '900', textAlign: 'center', marginBottom: 13 },
  radioRow: { flexDirection: 'row', justifyContent: 'center', gap: 42 },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.6, borderColor: '#1254D1', backgroundColor: '#FFFFFF' },
  radioCircleSelected: { borderWidth: 5, borderColor: '#1254D1' },
  radioText: { color: palette.navy, fontSize: 13, fontWeight: '700' },
  modalActions: { width: '100%', flexDirection: 'row', gap: 12, marginTop: 2 },
  cancelButton: { flex: 1, height: 46, borderRadius: 5, borderWidth: 1.3, borderColor: '#1254D1', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#1254D1', fontSize: 14, fontWeight: '900' },
  submitButton: { flex: 1, height: 46, borderRadius: 5, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  submitButtonDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  successModal: { width: '100%', maxWidth: 395, borderRadius: 18, backgroundColor: '#FFFFFF', paddingHorizontal: 34, paddingTop: 46, paddingBottom: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, elevation: 8 },
  successClose: { position: 'absolute', right: 17, top: 14, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#22C06B', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { color: palette.navy, fontSize: 30, lineHeight: 36, fontWeight: '900', textAlign: 'center', marginBottom: 15 },
  successText: { color: palette.navy, fontSize: 16.5, lineHeight: 28, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  okButton: { width: '100%', height: 58, borderRadius: 6, backgroundColor: '#0B50D4', alignItems: 'center', justifyContent: 'center' },
  okText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  pageHeader: { marginTop: -20, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageTitle: { color: palette.navy, fontSize: 22, lineHeight: 27, fontWeight: '900' },
  countBadge: { height: 24, borderRadius: 7, backgroundColor: '#EAF3FF', paddingHorizontal: 9, alignItems: 'center', justifyContent: 'center' },
  countBadgeText: { color: '#2563EB', fontSize: 11, fontWeight: '900' },
  pageSub: { color: palette.slate, fontSize: 12, fontWeight: '700', marginTop: 3 },
  addButton: { height: 40, borderRadius: 8, backgroundColor: palette.navy, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  filterPanel: { marginTop: -2, marginBottom: 10, gap: 7, zIndex: 20 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  globalSearch: { flex: 1.25, height: 42, borderRadius: 13, borderWidth: 1.4, borderColor: '#9FC4F5', backgroundColor: '#F3F8FF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 7, shadowColor: '#0A43A3', shadowOpacity: 0.08, shadowRadius: 8, elevation: 1 },
  globalSearchInput: { flex: 1, height: 38, color: palette.navy, fontSize: 12, fontWeight: '700' },
  clearSearch: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  companyDropdown: { flex: 0.9, height: 42, borderRadius: 13, borderWidth: 1.2, borderColor: '#B8D4F7', backgroundColor: '#FFFFFF', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  companyDropdownText: { flex: 1, color: palette.navy, fontSize: 11.2, fontWeight: '800' },
  companyMenu: { borderRadius: 13, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: palette.ink, shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  companyOption: { minHeight: 36, paddingHorizontal: 11, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#EEF2F6' },
  companyOptionActive: { backgroundColor: '#EEF5FF' },
  companyOptionText: { color: '#65758B', fontSize: 11, fontWeight: '800' },
  companyOptionTextActive: { color: palette.navy },

  vehicleCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', borderRadius: 16, marginBottom: 10, padding: 10, shadowColor: palette.ink, shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 },
  vehicleCardPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  cardMain: { flexDirection: 'row', gap: 10 },
  leftPane: { width: 164, paddingRight: 4 },
  accountName: { color: '#0A43A3', fontSize: 10.8, lineHeight: 13, fontWeight: '900', marginBottom: 3, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  vehicleNoChip: { minHeight: 31, borderRadius: 8, backgroundColor: '#EAF3FF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 5 },
  vehicleNoText: { color: palette.navy, fontSize: 15.2, lineHeight: 18, fontWeight: '900' },
  truckImage: { width: 148, height: 78, marginTop: 0, alignSelf: 'center', borderRadius: 10 },
  vehicleMake: { color: palette.navy, fontSize: 12.4, lineHeight: 15, fontWeight: '900', marginTop: 5 },

  rightPane: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: '#E5ECF5', paddingLeft: 10, position: 'relative' },
  infoBlock: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#E5ECF5' },
  infoIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  insurerLogo: { width: 24, height: 24 },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { color: palette.slate, fontSize: 9.8, fontWeight: '800' },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  infoValue: { color: palette.navy, fontSize: 11.4, lineHeight: 14, fontWeight: '900', marginTop: 1 },
  policyStatusDot: { width: 8, height: 8, borderRadius: 4 },
  policyStatusDotActive: { backgroundColor: '#12B76A' },
  policyStatusDotInactive: { backgroundColor: '#D92D20' },
  inlineAddPolicy: { alignSelf: 'flex-end', minHeight: 24, borderRadius: 8, borderWidth: 1, borderColor: '#B8D4F7', backgroundColor: '#F2F7FF', paddingHorizontal: 7, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  inlineAddPolicyText: { color: '#0A43A3', fontSize: 9.4, lineHeight: 12, fontWeight: '900' },
  dropdownButton: { position: 'absolute', right: 0, top: 0, width: 34, height: 34, borderRadius: 8, borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },

  complianceHealth: { minHeight: 28, marginTop: 8, paddingTop: 7, borderTopWidth: 1, borderTopColor: '#E5ECF5', flexDirection: 'row', alignItems: 'center', gap: 6 },
  complianceHealthLabel: { color: '#667085', fontSize: 10.5, lineHeight: 13, fontWeight: '800' },
  complianceHealthDivider: { width: 1, height: 13, backgroundColor: '#DCE8F4', marginHorizontal: 1 },
  complianceHealthTitle: { flex: 1, fontSize: 11.2, lineHeight: 14, fontWeight: '800' },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthDotGreen: { backgroundColor: '#12B76A' },
  healthDotYellow: { backgroundColor: '#F6C33B' },
  healthDotRed: { backgroundColor: '#D92D20' },
  healthDotGrey: { backgroundColor: '#98A2B3' },
  actionRow: { flexDirection: 'row', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5ECF5' },
  actionButton: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 9.2, lineHeight: 11, fontWeight: '900' },
  actionSub: { color: palette.slate, fontSize: 7.7, lineHeight: 9, fontWeight: '700', marginTop: 1 },

  protectionBanner: { minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: '#DCE8F4', backgroundColor: '#F8FBFF', padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  bannerIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EAF3FF', alignItems: 'center', justifyContent: 'center' },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { color: palette.navy, fontSize: 13.5, fontWeight: '900' },
  bannerText: { color: palette.slate, fontSize: 11.3, fontWeight: '700', marginTop: 3 },
  viewRenewals: { height: 38, borderRadius: 9, borderWidth: 1, borderColor: '#BBD2F2', backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  viewRenewalsText: { color: palette.navy, fontSize: 11.5, fontWeight: '900' },
});
