import { getObjectColorWithFallback } from '@/object-metadata/utils/getObjectColorWithFallback';

const buildObjectMetadataItem = ({
  nameSingular,
  color = null,
  isSystem = false,
}: {
  nameSingular: string;
  color?: string | null;
  isSystem?: boolean;
}) => ({
  nameSingular,
  color,
  isSystem,
});

describe('getObjectColorWithFallback', () => {
  it('should use distinct fallback colors for Company, Email, and Meeting Notes', () => {
    expect(
      getObjectColorWithFallback(
        buildObjectMetadataItem({ nameSingular: 'company' }),
      ),
    ).toBe('jade');
    expect(
      getObjectColorWithFallback(
        buildObjectMetadataItem({ nameSingular: 'emailMessage' }),
      ),
    ).toBe('blue');
    expect(
      getObjectColorWithFallback(
        buildObjectMetadataItem({ nameSingular: 'meetingNote' }),
      ),
    ).toBe('purple');
  });

  it('should prefer explicit object metadata colors', () => {
    expect(
      getObjectColorWithFallback(
        buildObjectMetadataItem({
          nameSingular: 'company',
          color: 'orange',
        }),
      ),
    ).toBe('orange');
  });
});
