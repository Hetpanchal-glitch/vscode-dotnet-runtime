import { DotnetInstallGraveyardEvent } from "../EventStream/EventStreamEvents";
import { IAcquisitionWorkerContext } from "./IAcquisitionWorkerContext";
import { DotnetInstall, GetDotnetInstallInfo, installKeyStringToDotnetInstall, IsEquivalentInstallationFile } from "./IInstallationRecord";

interface LocalDotnetInstall
{
    dotnetInstall: DotnetInstall;
    // The string is the path of the install once completed.
    path: string;
}

type LegacyGraveyardOrModernGraveyard = { [installKeys: string]: string } | Set<LocalDotnetInstall>

export class InstallationGraveyard
{
    private inProgressInstalls: Set<LocalDotnetInstall> = new Set<LocalDotnetInstall>();
    // The 'graveyard' includes failed uninstall paths and their install key.
    // These will become marked for attempted 'garbage collection' at the end of every acquisition.
    private readonly installPathsGraveyardKey = 'installPathsGraveyard';

    constructor(private readonly context : IAcquisitionWorkerContext)
    {

    }


    public clear() : void
    {
        this.inProgressInstalls.clear();
    }

    [Symbol.iterator]() : IterableIterator<DotnetInstall>
    {
        return [...this.inProgressInstalls].map(x => x.dotnetInstall as DotnetInstall)[Symbol.iterator]();
    }

    protected async getGraveyard() : Promise<Set<LocalDotnetInstall>>
    {
        let graveyard = this.context.extensionState.get<LegacyGraveyardOrModernGraveyard>(this.installPathsGraveyardKey, new Set<LocalDotnetInstall>());
        if(!(graveyard instanceof Set))
        {
            graveyard = new Set<LocalDotnetInstall>(
                Object.entries(graveyard).map(([key, path]) => ({ dotnetInstall: installKeyStringToDotnetInstall(key), path }) as LocalDotnetInstall)
            );
        }

        await this.context.extensionState.update(this.installPathsGraveyardKey, graveyard);
        return graveyard;
    }


    public async add(installKey : DotnetInstall, newPath : string)
    {
        const graveyard = await this.getGraveyard();
        graveyard.add({ dotnetInstall: installKey, path: newPath } as LocalDotnetInstall);
        await this.context.extensionState.update(this.installPathsGraveyardKey, graveyard);
    }

    public async remove(installKey : DotnetInstall)
    {
        const graveyard = await this.getGraveyard();
        const newGraveyard : Set<LocalDotnetInstall> = new Set([...graveyard].filter(x => !IsEquivalentInstallationFile(x.dotnetInstall, installKey)));
        await this.context.extensionState.update(this.installPathsGraveyardKey, newGraveyard);
    }

}