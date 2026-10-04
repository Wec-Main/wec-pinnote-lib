import { useAnnotationContext } from "../../../../context/AnnotationContext";
import { useSharedFetch } from "../../../../hooks/useSharedFetch";
import { useTokenGetter } from "../../../../hooks/useTokenGetter";
import { listFlows } from "../../../../services/flowchartService";
import { Icon, type IconName } from "../../../../components/primitives/Icon";
import { Spinner } from "../../../../components/primitives/Spinner";

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

interface SummaryRowProps {
  icon: IconName;
  label: string;
}

function SummaryRow({ icon, label }: SummaryRowProps) {
  return (
    <li className="wpn-publish-summary__row">
      <Icon name={icon} className="wpn-publish-summary__icon" />
      {label}
    </li>
  );
}

export function PublishSummary({ projectVersionId }: { projectVersionId: string }) {
  const { api, config, hostAuthenticated, activeAccount } = useAnnotationContext();
  const getToken = useTokenGetter(config.getAuthToken);
  const sessionKey = hostAuthenticated ? "host" : (activeAccount?.id ?? "");
  const scope = `${config.apiBaseUrl}:${sessionKey}:${config.projectId}:${projectVersionId}`;
  const comments = useSharedFetch(`all-annotations:${scope}`, (signal) =>
    api.listAnnotations({ projectId: config.projectId, projectVersionId }, signal),
  );
  const flows = useSharedFetch(`flows-count:${scope}`, (signal) =>
    getToken().then((authToken) =>
      listFlows(
        config.apiBaseUrl,
        authToken,
        { projectId: config.projectId, projectVersionId, limit: 1, offset: 0 },
        signal,
      ),
    ),
  );

  if (comments.error || flows.error) {
    return <p className="wpn-publish-summary__status">Couldn't count comments and flows.</p>;
  }
  if (!comments.data || !flows.data) {
    return (
      <p className="wpn-publish-summary__status">
        <Spinner />
        Counting comments and flows…
      </p>
    );
  }
  return (
    <ul className="wpn-publish-summary" aria-label="Included in this version">
      <SummaryRow icon="comment" label={countLabel(comments.data.length, "comment", "comments")} />
      <SummaryRow icon="flow" label={countLabel(flows.data.total, "flow", "flows")} />
    </ul>
  );
}
