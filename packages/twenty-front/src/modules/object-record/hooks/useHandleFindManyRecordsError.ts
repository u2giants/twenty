import { type ErrorLike } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';

import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback } from 'react';
import { logError } from '~/utils/logError';

/**
 * Checks if a GraphQL error is caused by a missing field (schema mismatch).
 * This happens when the frontend metadata includes fields that don't exist
 * in the production database yet (pre-cutover condition).
 */
const isSchemaMismatchError = (error: ErrorLike): boolean => {
  if (!CombinedGraphQLErrors.is(error)) {
    return false;
  }

  const schemaMismatchCodes = [
    'FIELD_NOT_FOUND',
    'RELATION_TARGET_OBJECT_METADATA_NOT_FOUND',
  ];

  return (
    error.errors?.some((e: { extensions?: { code?: string } }) =>
      schemaMismatchCodes.includes(e.extensions?.code ?? ''),
    ) ?? false
  );
};

export const useHandleFindManyRecordsError = ({
  handleError,
  objectMetadataItem,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
  handleError?: (error?: Error) => void;
}) => {
  const { enqueueErrorSnackBar } = useSnackBar();

  const handleFindManyRecordsError = useCallback(
    (error: ErrorLike) => {
      logError(
        `useFindManyRecords for "${objectMetadataItem.namePlural}" error : ` +
          error,
      );

      // Suppress toasts for schema mismatch errors (pre-cutover condition where
      // custom fields exist in metadata but not yet in the production database)
      if (isSchemaMismatchError(error)) {
        handleError?.(error as Error);
        return;
      }

      if (CombinedGraphQLErrors.is(error)) {
        enqueueErrorSnackBar({
          apolloError: error,
        });
      } else {
        enqueueErrorSnackBar({});
      }
      handleError?.(error as Error);
    },
    [enqueueErrorSnackBar, handleError, objectMetadataItem.namePlural],
  );

  return {
    handleFindManyRecordsError,
  };
};
