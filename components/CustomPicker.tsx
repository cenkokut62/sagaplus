import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

export interface PickerOption {
  label: string;
  value: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface CustomPickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  options: PickerOption[];
  onValueChange: (value: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export function CustomPicker({
  label,
  placeholder = 'Seçiniz',
  value,
  options,
  onValueChange,
  icon,
  error,
}: CustomPickerProps) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      )}
      <TouchableOpacity
        style={[
          styles.pickerButton,
          {
            backgroundColor: colors.inputBackground,
            borderColor: error ? colors.error : colors.inputBorder,
          },
        ]}
        onPress={() => setIsOpen(true)}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={colors.textSecondary}
            style={styles.leftIcon}
          />
        )}
        <View style={styles.valueContainer}>
          {selectedOption?.icon && (
            <Ionicons
              name={selectedOption.icon}
              size={18}
              color={colors.text}
              style={styles.optionIcon}
            />
          )}
          <Text
            style={[
              styles.valueText,
              {
                color: selectedOption ? colors.text : colors.textTertiary,
              },
            ]}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

      <Modal visible={isOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsOpen(false)}>
          <View
            style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: colors.cardBackground },
                ]}
              >
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    {label || placeholder}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsOpen(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="close" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={options}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.optionItem,
                        {
                          backgroundColor:
                            item.value === value
                              ? colors.surface
                              : colors.cardBackground,
                        },
                      ]}
                      onPress={() => handleSelect(item.value)}
                    >
                      {item.icon && (
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={colors.text}
                          style={styles.optionIcon}
                        />
                      )}
                      <Text style={[styles.optionText, { color: colors.text }]}>
                        {item.label}
                      </Text>
                      {item.value === value && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                          style={styles.checkIcon}
                        />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  leftIcon: {
    marginRight: 8,
  },
  valueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 16,
  },
  optionIcon: {
    marginRight: 8,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  optionText: {
    fontSize: 16,
    flex: 1,
  },
  checkIcon: {
    marginLeft: 8,
  },
});
